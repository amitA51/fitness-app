// ============================================================================
// COACH PLATFORM — Message service (async threads)
// ============================================================================
// One thread per coach<->client pair. RLS restricts rows to the two parties;
// either side may send (sender_id = self) and mark received messages read.

import type { Message } from '../../types/coach';
import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
import { requireClient, toMessage } from './mappers';
import { sendCoachPush } from './pushService';

export const getThread = async (coachId: string, clientId: string): Promise<Message[]> => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });
  if (error) {
    logger.db.error('getThread failed', error);
    return [];
  }
  return (data ?? []).map(toMessage);
};

export const sendMessage = async (
  coachId: string,
  clientId: string,
  body: string
): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return { error: 'unauthenticated' };
  const trimmed = body.trim();
  if (!trimmed) return { error: 'empty' };
  if (trimmed.length > 5000) return { error: 'message_too_long' };

  const { error } = await supabase.from('messages').insert({
    coach_id: coachId,
    client_id: clientId,
    sender_id: user.id,
    body: trimmed,
  });
  if (!error) {
    // Notify the other party with the app closed; deep-link to their thread view.
    const senderIsCoach = user.id === coachId;
    const recipient = senderIsCoach ? clientId : coachId;
    const url = senderIsCoach ? `/my-coach/messages/${coachId}` : `/coach/messages/${clientId}`;
    void sendCoachPush(recipient, 'הודעה חדשה', trimmed.slice(0, 140), url);
  }
  return { error: error?.message ?? null };
};

/** Mark all messages in a thread that were NOT sent by me as read. */
export const markThreadRead = async (coachId: string, clientId: string): Promise<void> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return;
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .neq('sender_id', user.id)
    .is('read_at', null);
  if (error) logger.db.error('markThreadRead failed', error);
};

/** Count of unread messages addressed to the current user across active relationships only. */
export const getUnreadCount = async (): Promise<number> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return 0;

  // Fetch active relationship pairs for this user
  const { data: activeLinks, error: linksError } = await supabase
    .from('coach_clients')
    .select('coach_id, client_id')
    .or(`coach_id.eq.${user.id},client_id.eq.${user.id}`)
    .eq('status', 'active');
  if (linksError || !activeLinks?.length) return 0;

  // Build an OR filter for each active thread
  const threadFilters = activeLinks
    .map(
      (l: { coach_id: string; client_id: string }) =>
        `and(coach_id.eq.${l.coach_id},client_id.eq.${l.client_id})`
    )
    .join(',');

  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .neq('sender_id', user.id)
    .is('read_at', null)
    .or(threadFilters);
  if (error) {
    logger.db.error('getUnreadCount failed', error);
    return 0;
  }
  return count ?? 0;
};
