/**
 * Supabase Real-Time Sync
 * SPARKOS Fitness App - Postgres changes subscriptions
 *
 * Extracted from supabaseSync.ts to keep that module under the file-size cap.
 * Re-exported from supabaseSync.ts for backward compatibility.
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

// ==================== REAL-TIME SYNC ====================

type RealtimeCallback = (payload: unknown) => void;
const realtimeChannels: Map<string, RealtimeChannel> = new Map();

export const subscribeToWorkoutTemplates = (
  userId: string,
  onInsert: RealtimeCallback,
  onUpdate: RealtimeCallback,
  onDelete: RealtimeCallback
): (() => void) => {
  if (!isSupabaseConfigured() || !supabase) return () => {};

  const channelName = `workout_templates:${userId}`;

  // removeChannel (not channel.unsubscribe) — unsubscribe alone leaves the
  // channel in the client registry, accumulating on every resubscribe.
  const existingTemplatesChannel = realtimeChannels.get(channelName);
  if (existingTemplatesChannel) {
    void supabase.removeChannel(existingTemplatesChannel);
    realtimeChannels.delete(channelName);
  }

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'workout_templates',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onInsert(payload)
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'workout_templates',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onUpdate(payload)
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'workout_templates',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onDelete(payload)
    )
    .subscribe();

  realtimeChannels.set(channelName, channel);

  return () => {
    void supabase?.removeChannel(channel);
    realtimeChannels.delete(channelName);
  };
};

export const subscribeToWorkoutSessions = (
  userId: string,
  onInsert: RealtimeCallback,
  onUpdate: RealtimeCallback,
  onDelete: RealtimeCallback
): (() => void) => {
  if (!isSupabaseConfigured() || !supabase) return () => {};

  const channelName = `workout_sessions:${userId}`;

  // removeChannel (not channel.unsubscribe) — unsubscribe alone leaves the
  // channel in the client registry, accumulating on every resubscribe.
  const existingSessionsChannel = realtimeChannels.get(channelName);
  if (existingSessionsChannel) {
    void supabase.removeChannel(existingSessionsChannel);
    realtimeChannels.delete(channelName);
  }

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'workout_sessions',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onInsert(payload)
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'workout_sessions',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onUpdate(payload)
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'workout_sessions',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onDelete(payload)
    )
    .subscribe();

  realtimeChannels.set(channelName, channel);

  return () => {
    void supabase?.removeChannel(channel);
    realtimeChannels.delete(channelName);
  };
};
