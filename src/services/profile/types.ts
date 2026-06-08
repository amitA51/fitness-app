// ============================================================================
// ADVANCED PROFILE — shared types for the profile service layer.
//
// Mirrors the public-safe columns added in 20260610000000_advanced_profile.sql
// plus the achievements catalog/ledger. PII (DOB, body metrics) is deliberately
// absent here — it lives in user_age_verification and the local UserProfile.
// ============================================================================

/** Public-safe profile fields, synced to the server `profiles` row. */
export interface ProfilePublic {
  id: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  isPublic: boolean;
}

/** A patch of editable public-profile fields (all optional). */
export type ProfilePatch = Partial<
  Pick<ProfilePublic, 'displayName' | 'bio' | 'avatarUrl' | 'isPublic'>
>;

/** Catalog entry describing an earnable badge. */
export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  createdAt: string | null;
}

/** A badge a specific user has earned. */
export interface UserAchievement {
  userId: string;
  achievementId: string;
  awardedAt: string;
}
