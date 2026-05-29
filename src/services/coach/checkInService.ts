// ============================================================================
// COACH PLATFORM — check-ins & private coach notes
// ============================================================================
// A trainee logs periodic check-ins (RLS: owner writes, their active coach
// reads). Coach notes are private to the authoring coach — the client never
// sees them. Online-only, like the rest of the coach data path.

import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
import { requireClient } from './mappers';

export interface CheckIn {
  id: string;
  userId: string;
  date: string;
  weight: number | null;
  mood: number | null;
  energy: number | null;
  notes: string | null;
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
}

type Row = Record<string, unknown>;

const toCheckIn = (r: Row): CheckIn => ({
  id: r.id as string,
  userId: r.user_id as string,
  date: r.date as string,
  weight: (r.weight as number | null) ?? null,
  mood: (r.mood as number | null) ?? null,
  energy: (r.energy as number | null) ?? null,
  notes: (r.notes as string | null) ?? null,
  createdAt: r.created_at as string | undefined,
});

const toCoachNote = (r: Row): CoachNote => ({
  id: r.id as string,
  coachId: r.coach_id as string,
  clientId: r.client_id as string,
  body: r.body as string,
  createdAt: r.created_at as string | undefined,
});

/** Trainee submits a check-in for themselves. */
export const submitCheckIn = async (input: NewCheckIn): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return { error: 'unauthenticated' };
  const { error } = await supabase.from('check_ins').insert({
    user_id: user.id,
    date: input.date ?? new Date().toISOString().slice(0, 10),
    weight: input.weight ?? null,
    mood: input.mood ?? null,
    energy: input.energy ?? null,
    notes: input.notes?.trim() || null,
  });
  if (error) logger.db.error('submitCheckIn failed', error);
  return { error: error?.message ?? null };
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
    return [];
  }
  return (data ?? []).map(toCheckIn);
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
    return [];
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
