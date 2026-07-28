// ============================================================================
// AI Chat - Chat management with history
// ============================================================================

import { generateId } from '../../utils/id';
import { STORES, dbDelete, dbGet, dbGetAll, dbPut } from '../indexedDBCore';
import { getCurrentUser } from '../supabaseAuth';
import { softDeleteCloudAIConversation, syncAIConversation } from '../supabaseSync';
import { syncWithRetry } from '../syncEngine';
import { type ChatMessage, getAIProvider } from './core';

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

const CURRENT_CONVERSATION_KEY = 'ai_current_conversation';

// Cap the number of historical messages forwarded to the AI provider per turn.
// Long conversations otherwise inflate token cost without improving answers.
const MAX_HISTORY_MESSAGES = 20;

/**
 * Stamp a persisted message with a stable id and timestamp.
 *
 * Not cosmetic: `unionMessagesById` (cloudMerge) skips any message without an
 * `id` — `if (!msg || !msg.id) continue`. Messages were being written as bare
 * `{ role, content }`, so the moment a conversation was merged from the cloud
 * EVERY local message was silently dropped and the chat came back empty. The
 * timestamp is what orders the union, so both are required.
 */
const stampMessage = (msg: ChatMessage): ChatMessage => ({
  ...msg,
  id: msg.id ?? crypto.randomUUID?.() ?? generateId('msg', 8),
  timestamp: msg.timestamp ?? new Date().toISOString(),
});

/**
 * Push a conversation to the cloud, queueing it when offline.
 *
 * Conversations used to be written to IndexedDB only. They were listed in the
 * BULK push, but the only production caller of that is the manual "upload to
 * cloud" button in Settings — so in practice a chat stayed on one device
 * indefinitely and was destroyed by the next account switch. Fire-and-forget
 * with the queue as the fallback, matching every other write path.
 */
const syncConversation = async (conversation: Conversation): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) return;
  const payload = {
    id: conversation.id,
    title: conversation.title,
    // Re-stamp defensively. The cloud shape REQUIRES id + timestamp on every
    // message (they are the union key in cloudMerge.unionMessagesById), and a
    // conversation persisted by an older build predates stampMessage. Sending an
    // id-less message would make the merge drop it on the way back down.
    messages: conversation.messages.map((m) => {
      const s = stampMessage(m);
      return {
        id: s.id as string,
        role: s.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: s.content,
        timestamp: s.timestamp as string,
      };
    }),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
  syncWithRetry(
    () => syncAIConversation(user.id, payload),
    `syncConversation:${conversation.id}`,
    3,
    { type: 'ai:create', payload }
  );
};

export async function createConversation(title = 'שיחה חדשה'): Promise<Conversation> {
  const conversation: Conversation = {
    // UUID — cloud ai_conversations.id is uuid; PostgREST rejects `conv-...`
    // ids with 22P02, so the bulk push silently dropped these conversations.
    id: crypto.randomUUID?.() || generateId('conv', 5),
    title,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await dbPut(STORES.AI_CONVERSATIONS, conversation);
  localStorage.setItem(CURRENT_CONVERSATION_KEY, conversation.id);
  return conversation;
}

export async function getCurrentConversation(): Promise<Conversation | null> {
  const convId = localStorage.getItem(CURRENT_CONVERSATION_KEY);
  if (!convId) return null;

  try {
    return await dbGet<Conversation>(STORES.AI_CONVERSATIONS, convId);
  } catch {
    return null;
  }
}

export async function getOrCreateConversation(): Promise<Conversation> {
  const existing = await getCurrentConversation();
  if (existing) return existing;
  return createConversation();
}

export async function sendMessage(
  userMessage: string,
  systemPrompt?: string
): Promise<{ response: string; conversation: Conversation }> {
  const conversation = await getOrCreateConversation();

  // Trim the slice we forward to the provider. Full history is still
  // persisted locally; only the prompt sent to the AI is capped.
  const recentMessages = conversation.messages.slice(-MAX_HISTORY_MESSAGES);

  const newMessages: ChatMessage[] = [
    ...conversation.messages,
    stampMessage({ role: 'user', content: userMessage }),
  ];

  const provider = getAIProvider();

  const chatMessages: ChatMessage[] = [];
  if (systemPrompt) {
    chatMessages.push({ role: 'system', content: systemPrompt });
  }
  chatMessages.push(...recentMessages, { role: 'user', content: userMessage });

  const response = await provider.chat(chatMessages);

  newMessages.push(stampMessage({ role: 'assistant', content: response }));

  const updatedConversation: Conversation = {
    ...conversation,
    messages: newMessages,
    updatedAt: new Date().toISOString(),
    title: conversation.messages.length === 0 ? userMessage.slice(0, 50) : conversation.title,
  };

  await dbPut(STORES.AI_CONVERSATIONS, updatedConversation);
  // Reach the cloud on the normal write path, not only via a manual full upload.
  void syncConversation(updatedConversation);

  return { response, conversation: updatedConversation };
}

export async function clearConversation(): Promise<void> {
  const conversation = await getCurrentConversation();
  if (conversation) {
    await dbDelete(STORES.AI_CONVERSATIONS, conversation.id);
    // Same tombstone as deleteConversation. A local-only delete was resurrected
    // by the next pull, because a live cloud row missing locally is re-added.
    const user = await getCurrentUser();
    if (user) {
      syncWithRetry(
        () => softDeleteCloudAIConversation(user.id, conversation.id),
        `clearConversation:${conversation.id}`,
        3,
        { type: 'ai:delete', payload: conversation.id }
      );
    }
  }
  localStorage.removeItem(CURRENT_CONVERSATION_KEY);
}

export async function getAllConversations(): Promise<Conversation[]> {
  const all = await dbGetAll<Conversation>(STORES.AI_CONVERSATIONS);
  return all.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export async function deleteConversation(id: string): Promise<void> {
  await dbDelete(STORES.AI_CONVERSATIONS, id);
  const current = localStorage.getItem(CURRENT_CONVERSATION_KEY);
  if (current === id) {
    localStorage.removeItem(CURRENT_CONVERSATION_KEY);
  }

  // Propagate as a cloud soft-delete (tombstone). Without this the conversation
  // was only removed locally — it resurrected on the next pull and never
  // reached the user's other devices. Offline-safe via the mutation queue.
  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(() => softDeleteCloudAIConversation(user.id, id), `deleteConversation:${id}`, 3, {
      type: 'ai:delete',
      payload: id,
    });
  }
}
