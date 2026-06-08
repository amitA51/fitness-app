// ============================================================================
// ADVANCED PROFILE — data + service layer for public-safe profile fields,
// avatar upload, and the achievements engine.
//
// FAIL-SAFE-INERT: every function guards an unconfigured Supabase client and a
// missing migration. Reads return safe empty defaults; writes return a
// { error } envelope. Nothing throws to the UI — a not-yet-applied migration or
// local-only mode degrades gracefully, never crashes.
// ============================================================================

import { supabase } from '../../lib/supabase';
import { compressImageToWebP } from '../../utils/imageCompress';
import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
import type { Achievement, ProfilePatch, ProfilePublic, UserAchievement } from './types';

/** Public-read Storage bucket holding user avatars. Path: {uid}/avatar.webp */
export const AVATARS_BUCKET = 'avatars';

type Row = Record<string, unknown>;

const asString = (v: unknown): string | null => (typeof v === 'string' ? v : null);

const toProfilePublic = (r: Row): ProfilePublic => ({
  id: (r.id as string | undefined) ?? '',
  displayName: asString(r.display_name),
  bio: asString(r.bio),
  avatarUrl: asString(r.avatar_url),
  isPublic: r.is_public === true,
});

const toAchievement = (r: Row): Achievement => ({
  id: (r.id as string | undefined) ?? '',
  title: asString(r.title) ?? '',
  description: asString(r.description) ?? '',
  icon: asString(r.icon) ?? 'award',
  category: asString(r.category) ?? 'general',
  createdAt: asString(r.created_at),
});

const toUserAchievement = (r: Row): UserAchievement => ({
  userId: (r.user_id as string | undefined) ?? '',
  achievementId: (r.achievement_id as string | undefined) ?? '',
  awardedAt: asString(r.awarded_at) ?? '',
});

/** The public-safe columns we select — never role/body-metrics/DOB. */
const PUBLIC_COLUMNS = 'id, display_name, bio, avatar_url, is_public';

/**
 * The current user's public-safe profile, or null when unauthenticated /
 * unconfigured / the migration is not applied yet.
 */
export const getMyProfile = async (): Promise<ProfilePublic | null> => {
  if (!supabase) return null;
  const user = await getCurrentUser();
  if (!user) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(PUBLIC_COLUMNS)
      .eq('id', user.id)
      .maybeSingle();
    if (error) {
      logger.db.error('getMyProfile failed', error);
      return null;
    }
    return data ? toProfilePublic(data as Row) : null;
  } catch (err) {
    logger.db.error('getMyProfile threw', err);
    return null;
  }
};

/**
 * Patch the current user's public-safe profile fields. Maps camelCase patch
 * keys to snake_case columns; omits undefined keys so a partial patch never
 * clobbers untouched columns.
 */
export const updateProfile = async (patch: ProfilePatch): Promise<{ error: string | null }> => {
  if (!supabase) return { error: 'unconfigured' };
  const user = await getCurrentUser();
  if (!user) return { error: 'unauthenticated' };

  const update: Row = {};
  if (patch.displayName !== undefined) update.display_name = patch.displayName;
  if (patch.bio !== undefined) update.bio = patch.bio;
  if (patch.avatarUrl !== undefined) update.avatar_url = patch.avatarUrl;
  if (patch.isPublic !== undefined) update.is_public = patch.isPublic;
  if (Object.keys(update).length === 0) return { error: null };

  try {
    const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
    if (error) logger.db.error('updateProfile failed', error);
    return { error: error?.message ?? null };
  } catch (err) {
    logger.db.error('updateProfile threw', err);
    return { error: err instanceof Error ? err.message : 'update_failed' };
  }
};

/**
 * Compress an image to WebP and upsert it to {uid}/avatar.webp in the public
 * `avatars` bucket, persist the resulting public URL on the profile row, and
 * return that URL. Returns { url: null, error } on any failure.
 */
export const uploadAvatar = async (
  file: File
): Promise<{ url: string | null; error: string | null }> => {
  if (!supabase) return { url: null, error: 'unconfigured' };
  const user = await getCurrentUser();
  if (!user) return { url: null, error: 'unauthenticated' };

  try {
    const blob = await compressImageToWebP(file);
    const path = `${user.id}/avatar.webp`;
    const { error: uploadError } = await supabase.storage
      .from(AVATARS_BUCKET)
      .upload(path, blob, { contentType: 'image/webp', upsert: true });
    if (uploadError) {
      logger.db.error('uploadAvatar: upload failed', uploadError);
      return { url: null, error: uploadError.message };
    }

    const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
    // Cache-bust so a replaced avatar refreshes immediately at the same path.
    const url = `${data.publicUrl}?v=${Date.now()}`;

    const { error: patchError } = await updateProfile({ avatarUrl: url });
    if (patchError) return { url, error: patchError };
    return { url, error: null };
  } catch (err) {
    logger.db.error('uploadAvatar threw', err);
    return { url: null, error: err instanceof Error ? err.message : 'upload_failed' };
  }
};

/**
 * Another user's public profile — only resolves when RLS allows it (the row's
 * is_public = true). Returns null otherwise. Never exposes DOB/body metrics.
 */
export const getPublicProfile = async (userId: string): Promise<ProfilePublic | null> => {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(PUBLIC_COLUMNS)
      .eq('id', userId)
      .eq('is_public', true)
      .maybeSingle();
    if (error) {
      logger.db.error('getPublicProfile failed', error);
      return null;
    }
    return data ? toProfilePublic(data as Row) : null;
  } catch (err) {
    logger.db.error('getPublicProfile threw', err);
    return null;
  }
};

/** The full achievements catalog. Empty array when unavailable. */
export const listAchievements = async (): Promise<Achievement[]> => {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('achievements')
      .select('id, title, description, icon, category, created_at')
      .order('created_at', { ascending: true });
    if (error) {
      logger.db.error('listAchievements failed', error);
      return [];
    }
    return (data ?? []).map((r) => toAchievement(r as Row));
  } catch (err) {
    logger.db.error('listAchievements threw', err);
    return [];
  }
};

/**
 * Badges a user has earned. RLS returns rows only for the caller's own id or a
 * public profile; anything else yields an empty array.
 */
export const getUserAchievements = async (userId: string): Promise<UserAchievement[]> => {
  if (!supabase || !userId) return [];
  try {
    const { data, error } = await supabase
      .from('user_achievements')
      .select('user_id, achievement_id, awarded_at')
      .eq('user_id', userId)
      .order('awarded_at', { ascending: false });
    if (error) {
      logger.db.error('getUserAchievements failed', error);
      return [];
    }
    return (data ?? []).map((r) => toUserAchievement(r as Row));
  } catch (err) {
    logger.db.error('getUserAchievements threw', err);
    return [];
  }
};

/**
 * Award an achievement to the current user via the SECURITY DEFINER RPC. The
 * client never writes user_achievements directly. Idempotent server-side
 * (ON CONFLICT DO NOTHING); fail-open on any error.
 */
export const awardAchievement = async (
  achievementId: string
): Promise<{ error: string | null }> => {
  if (!supabase) return { error: 'unconfigured' };
  if (!achievementId) return { error: 'invalid' };
  const user = await getCurrentUser();
  if (!user) return { error: 'unauthenticated' };
  try {
    const { error } = await supabase.rpc('award_achievement', {
      _achievement_id: achievementId,
    });
    if (error) logger.db.error('awardAchievement failed', error);
    return { error: error?.message ?? null };
  } catch (err) {
    logger.db.error('awardAchievement threw', err);
    return { error: err instanceof Error ? err.message : 'award_failed' };
  }
};
