// ============================================================================
// COACH PLATFORM — Supabase guard + row mappers
// ============================================================================
// Coach features are ONLINE-only: unlike the trainee's local-first path, coach
// screens read/write Supabase directly (the local IndexedDB is wiped on logout
// and only ever holds the current user's own data). `requireClient()` makes the
// connectivity requirement explicit instead of silently no-op'ing.

import { type SupabaseClient, isSupabaseConfigured, supabase } from '../../lib/supabase';
import type {
  Assignment,
  ClientGroup,
  CoachClient,
  CoachInvite,
  CoachProfile,
  CoachSubscription,
  Message,
  Profile,
  Reminder,
} from '../../types/coach';

/** Error thrown when a coach operation is attempted without cloud connectivity. */
export class CoachOfflineError extends Error {
  constructor() {
    super('Coach features require an online connection.');
    this.name = 'CoachOfflineError';
  }
}

/** Return a guaranteed Supabase client or throw — coach features cannot work offline. */
export function requireClient(): SupabaseClient {
  if (!isSupabaseConfigured() || !supabase) {
    throw new CoachOfflineError();
  }
  return supabase;
}

// ---- row -> domain mappers (snake_case columns -> camelCase domain) --------

type Row = Record<string, unknown>;

export const toProfile = (r: Row): Profile => ({
  id: r.id as string,
  displayName: (r.display_name as string | null) ?? null,
  avatarUrl: (r.avatar_url as string | null) ?? null,
  createdAt: r.created_at as string | undefined,
  updatedAt: r.updated_at as string | undefined,
});

export const toCoachProfile = (r: Row): CoachProfile => ({
  id: r.id as string,
  businessName: (r.business_name as string | null) ?? null,
  bio: (r.bio as string | null) ?? null,
  settings: (r.settings as Record<string, unknown>) ?? {},
  createdAt: r.created_at as string | undefined,
  updatedAt: r.updated_at as string | undefined,
});

export const toCoachClient = (r: Row): CoachClient => ({
  id: r.id as string,
  coachId: r.coach_id as string,
  clientId: r.client_id as string,
  status: r.status as CoachClient['status'],
  consentAt: (r.consent_at as string | null) ?? null,
  scopes: (r.scopes as CoachClient['scopes']) ?? {},
  tags: (r.tags as string[]) ?? [],
  createdAt: r.created_at as string | undefined,
  updatedAt: r.updated_at as string | undefined,
  clientProfile: r.client_profile ? toProfile(r.client_profile as Row) : undefined,
  coachProfile: r.coach_profile ? toProfile(r.coach_profile as Row) : undefined,
});

export const toInvite = (r: Row): CoachInvite => ({
  id: r.id as string,
  coachId: r.coach_id as string,
  email: (r.email as string | null) ?? null,
  code: r.code as string,
  status: r.status as CoachInvite['status'],
  clientId: (r.client_id as string | null) ?? null,
  expiresAt: (r.expires_at as string | null) ?? null,
  createdAt: r.created_at as string | undefined,
});

export const toGroup = (r: Row): ClientGroup => ({
  id: r.id as string,
  coachId: r.coach_id as string,
  name: r.name as string,
  createdAt: r.created_at as string | undefined,
  memberCount: typeof r.member_count === 'number' ? (r.member_count as number) : undefined,
});

export const toAssignment = (r: Row): Assignment => ({
  id: r.id as string,
  coachId: r.coach_id as string,
  clientId: (r.client_id as string | null) ?? null,
  groupId: (r.group_id as string | null) ?? null,
  kind: r.kind as Assignment['kind'],
  title: (r.title as string | null) ?? null,
  payload: (r.payload as Record<string, unknown>) ?? {},
  templateId: (r.template_id as string | null) ?? null,
  schedule: (r.schedule as Record<string, unknown> | null) ?? null,
  status: (r.status as Assignment['status']) ?? 'active',
  createdAt: r.created_at as string | undefined,
  updatedAt: r.updated_at as string | undefined,
});

export const toMessage = (r: Row): Message => ({
  id: r.id as string,
  coachId: r.coach_id as string,
  clientId: r.client_id as string,
  senderId: r.sender_id as string,
  body: r.body as string,
  attachments: (r.attachments as unknown[]) ?? [],
  readAt: (r.read_at as string | null) ?? null,
  createdAt: r.created_at as string | undefined,
});

export const toReminder = (r: Row): Reminder => ({
  id: r.id as string,
  coachId: r.coach_id as string,
  clientId: (r.client_id as string | null) ?? null,
  groupId: (r.group_id as string | null) ?? null,
  title: r.title as string,
  body: (r.body as string | null) ?? null,
  schedule: (r.schedule as Reminder['schedule']) ?? {},
  createdAt: r.created_at as string | undefined,
});

export const toSubscription = (r: Row): CoachSubscription => ({
  coachId: r.coach_id as string,
  plan: r.plan as CoachSubscription['plan'],
  seatLimit: (r.seat_limit as number) ?? 1,
  status: r.status as CoachSubscription['status'],
  createdAt: r.created_at as string | undefined,
  updatedAt: r.updated_at as string | undefined,
});
