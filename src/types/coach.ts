// ============================================================================
// COACH PLATFORM — domain types
// ============================================================================
// Mirrors the coaching tables added in migrations/20260529000000_coach_platform.sql.
// These power the coach-side (direct-Supabase) data path; the trainee's own
// data continues to use the canonical types in ./index.ts.

export type CoachClientStatus = 'pending' | 'active' | 'paused' | 'ended';
export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type AssignmentKind = 'program' | 'nutrition_target' | 'note' | 'announcement';
export type CoachPlan = 'free' | 'solo' | 'starter' | 'pro' | 'elite';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled';

/**
 * Server-side role classification (profiles.role) — the ONLY source of truth for
 * "who is a coach". Assigned by the app owner; there is no client-side override.
 */
export type UserRole = 'coach' | 'trainee';

export interface Profile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
}

export interface CoachProfile {
  id: string;
  businessName: string | null;
  bio: string | null;
  settings: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CoachClient {
  id: string;
  coachId: string;
  clientId: string;
  status: CoachClientStatus;
  consentAt: string | null;
  scopes: { read?: boolean; write?: boolean };
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
  /** Joined profile of the client (roster views). */
  clientProfile?: Profile;
  /** Joined profile of the coach (trainee "My Coach" view). */
  coachProfile?: Profile;
}

export interface CoachInvite {
  id: string;
  coachId: string;
  email: string | null;
  code: string;
  status: InviteStatus;
  clientId: string | null;
  expiresAt: string | null;
  createdAt?: string;
}

export interface ClientGroup {
  id: string;
  coachId: string;
  name: string;
  createdAt?: string;
  /** Optional member count for list views. */
  memberCount?: number;
}

export interface Assignment {
  id: string;
  coachId: string;
  clientId: string | null;
  groupId: string | null;
  kind: AssignmentKind;
  title: string | null;
  payload: Record<string, unknown>;
  templateId: string | null;
  schedule: Record<string, unknown> | null;
  status: 'active' | 'archived';
  createdAt?: string;
  updatedAt?: string;
}

export interface Message {
  id: string;
  coachId: string;
  clientId: string;
  senderId: string;
  body: string;
  attachments: unknown[];
  readAt: string | null;
  createdAt?: string;
}

export interface Reminder {
  id: string;
  coachId: string;
  clientId: string | null;
  groupId: string | null;
  title: string;
  body: string | null;
  schedule: ReminderSchedule;
  createdAt?: string;
}

export interface ReminderSchedule {
  /** HH:MM local time the reminder should fire. */
  time?: string;
  /** Days of week (0=Sun..6=Sat); empty/undefined = every day. */
  days?: number[];
  /** Optional one-off ISO date. */
  date?: string;
}

export interface CoachSubscription {
  coachId: string;
  plan: CoachPlan;
  seatLimit: number;
  status: SubscriptionStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  createdAt?: string;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  body: string;
  createdAt?: string;
}

export interface GroupThreadSummary {
  groupId: string;
  name: string;
  lastBody: string | null;
  lastAt: string | null;
  unread: number;
}

export interface ProgramTemplateDay {
  name: string;
  exercises: Array<{
    exerciseName: string;
    exerciseId: string;
    targetMuscle: string;
    sets: number;
    reps: number;
  }>;
}

export interface CoachProgramTemplate {
  id: string;
  coachId: string;
  name: string;
  description: string | null;
  days: ProgramTemplateDay[];
  createdAt?: string;
  updatedAt?: string;
}
