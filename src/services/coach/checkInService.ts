// ============================================================================
// COACH PLATFORM — check-ins & private coach notes
// ============================================================================
// A trainee logs periodic check-ins (RLS: owner writes, their active coach
// reads). Coach notes are private to the authoring coach — the client never
// sees them. Online-only, like the rest of the coach data path.

import { compressImageToWebP } from '../../utils/imageCompress';
import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
import { requireClient } from './mappers';

/** Private storage bucket holding trainee progress photos. */
export const PROGRESS_PHOTOS_BUCKET = 'progress-photos';

/** One hour — signed URLs are short-lived; the viewer re-fetches on reload. */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** A stored progress photo: bucket path plus its decoded pixel dimensions. */
export interface PhotoRef {
  path: string;
  width: number;
  height: number;
}

export interface CheckIn {
  id: string;
  userId: string;
  date: string;
  weight: number | null;
  mood: number | null;
  energy: number | null;
  notes: string | null;
  photos: PhotoRef[];
  createdAt?: string;
}

export interface CoachNote {
  id: string;
  coachId: string;
  clientId: string;
  body: string;
  createdAt?: string;
}

export interface NewCheckIn {
  weight?: number | null;
  mood?: number | null;
  energy?: number | null;
  notes?: string;
  date?: string;
  photos?: PhotoRef[];
}

type Row = Record<string, unknown>;

/** Narrow an unknown JSONB array into PhotoRef[], dropping malformed entries. */
const toPhotoRefs = (raw: unknown): PhotoRef[] => {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry): PhotoRef[] => {
    if (entry === null || typeof entry !== 'object') return [];
    const e = entry as Record<string, unknown>;
    if (typeof e.path !== 'string') return [];
    return [
      {
        path: e.path,
        width: typeof e.width === 'number' ? e.width : 0,
        height: typeof e.height === 'number' ? e.height : 0,
      },
    ];
  });
};

const toCheckIn = (r: Row): CheckIn => ({
  id: r.id as string,
  userId: r.user_id as string,
  date: r.date as string,
  weight: (r.weight as number | null) ?? null,
  mood: (r.mood as number | null) ?? null,
  energy: (r.energy as number | null) ?? null,
  notes: (r.notes as string | null) ?? null,
  photos: toPhotoRefs(r.photos),
  createdAt: r.created_at as string | undefined,
});

const toCoachNote = (r: Row): CoachNote => ({
  id: r.id as string,
  coachId: r.coach_id as string,
  clientId: r.client_id as string,
  body: r.body as string,
  createdAt: r.created_at as string | undefined,
});

/**
 * Trainee submits a check-in for themselves. Returns the created row id (when
 * available) so the caller can attach photos under {userId}/{checkInId}/… — the
 * photo path needs the id, so the row is created first and patched afterward.
 * Backward compatible: callers that only read `.error` keep working.
 */
export const submitCheckIn = async (
  input: NewCheckIn
): Promise<{ error: string | null; id: string | null }> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return { error: 'unauthenticated', id: null };
  const { data, error } = await supabase
    .from('check_ins')
    .insert({
      user_id: user.id,
      date: input.date ?? new Date().toISOString().slice(0, 10),
      weight: input.weight ?? null,
      mood: input.mood ?? null,
      energy: input.energy ?? null,
      notes: input.notes?.trim() || null,
      photos: input.photos ?? [],
    })
    .select('id')
    .single();
  if (error) logger.db.error('submitCheckIn failed', error);
  return { error: error?.message ?? null, id: (data?.id as string | undefined) ?? null };
};

/** Patch an existing check-in's photo refs (after uploads complete). */
export const updateCheckInPhotos = async (
  checkInId: string,
  refs: PhotoRef[]
): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  const { error } = await supabase.from('check_ins').update({ photos: refs }).eq('id', checkInId);
  if (error) logger.db.error('updateCheckInPhotos failed', error);
  return { error: error?.message ?? null };
};

/**
 * Compress and upload progress photos for a check-in. Each file is handled
 * independently: a per-file failure is collected into `errors` and does NOT
 * abort the others, so a partial upload still returns the refs that succeeded.
 */
export const uploadCheckInPhotos = async (
  checkInId: string,
  files: File[]
): Promise<{ refs: PhotoRef[]; errors: string[] }> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return { refs: [], errors: files.map(() => 'unauthenticated') };

  const refs: PhotoRef[] = [];
  const errors: string[] = [];

  for (const file of files) {
    try {
      const blob = await compressImageToWebP(file);
      const dims = await readBlobDimensions(blob);
      const path = `${user.id}/${checkInId}/${crypto.randomUUID()}.webp`;
      const { error } = await supabase.storage
        .from(PROGRESS_PHOTOS_BUCKET)
        .upload(path, blob, { contentType: 'image/webp' });
      if (error) {
        logger.db.error('uploadCheckInPhotos: upload failed', error);
        errors.push(error.message);
        continue;
      }
      refs.push({ path, width: dims.width, height: dims.height });
    } catch (err) {
      logger.db.error('uploadCheckInPhotos: compress failed', err);
      errors.push(err instanceof Error ? err.message : 'upload_failed');
    }
  }

  return { refs, errors };
};

/** Best-effort decode of a blob to read its pixel dimensions (0×0 on failure). */
const readBlobDimensions = async (blob: Blob): Promise<{ width: number; height: number }> => {
  try {
    const bitmap = await createImageBitmap(blob);
    const dims = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dims;
  } catch {
    return { width: 0, height: 0 };
  }
};

/**
 * Resolve PhotoRef paths to short-lived signed URLs in one batched call.
 * Returns a Map keyed by storage path; paths that fail to sign are omitted, so
 * the caller can render a per-photo fallback for any missing key.
 */
export const getPhotoUrls = async (refs: PhotoRef[]): Promise<Map<string, string>> => {
  const urls = new Map<string, string>();
  if (refs.length === 0) return urls;
  const supabase = requireClient();
  const paths = refs.map((r) => r.path);
  const { data, error } = await supabase.storage
    .from(PROGRESS_PHOTOS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error) {
    logger.db.error('getPhotoUrls failed', error);
    return urls;
  }
  for (const item of data ?? []) {
    if (item.signedUrl && item.path) urls.set(item.path, item.signedUrl);
  }
  return urls;
};

/** List check-ins for a user (RLS allows the owner or their active coach). */
export const listCheckIns = async (userId: string, limit = 30): Promise<CheckIn[]> => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('check_ins')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) {
    logger.db.error('listCheckIns failed', error);
    // Throw so callers' error states fire instead of a fake "no check-ins".
    throw new Error(error.message);
  }
  return (data ?? []).map(toCheckIn);
};

/**
 * Which of the given clients submitted a check-in within the last `sinceDays`.
 * ONE query (check_ins where user_id IN clientIds and date >= cutoff), reduced
 * to a Set of client ids — no N+1. Empty input short-circuits to an empty Set.
 * RLS limits rows to the calling coach's active clients.
 */
export const getRecentCheckInFlags = async (
  clientIds: string[],
  sinceDays = 7
): Promise<Set<string>> => {
  const flagged = new Set<string>();
  if (clientIds.length === 0) return flagged;

  let supabase: ReturnType<typeof requireClient>;
  try {
    supabase = requireClient();
  } catch {
    return flagged;
  }

  const cutoff = new Date(Date.now() - sinceDays * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('check_ins')
    .select('user_id')
    .in('user_id', clientIds)
    .gte('date', cutoff);
  if (error) {
    logger.db.error('getRecentCheckInFlags failed', error);
    return flagged;
  }

  for (const row of data ?? []) {
    flagged.add((row as { user_id: string }).user_id);
  }
  return flagged;
};

/** A coach's private notes about a client. */
export const listCoachNotes = async (clientId: string): Promise<CoachNote[]> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('coach_notes')
    .select('*')
    .eq('coach_id', user.id)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) {
    logger.db.error('listCoachNotes failed', error);
    // Throw so the notes box shows its error state, not a fake "no notes".
    throw new Error(error.message);
  }
  return (data ?? []).map(toCoachNote);
};

export const addCoachNote = async (
  clientId: string,
  body: string
): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return { error: 'unauthenticated' };
  const trimmed = body.trim();
  if (!trimmed) return { error: 'empty' };
  const { error } = await supabase
    .from('coach_notes')
    .insert({ coach_id: user.id, client_id: clientId, body: trimmed });
  return { error: error?.message ?? null };
};
