// ============================================================================
// AI Chat - Chat management with history
// ============================================================================

import { generateId } from '../../utils/id';
import { STORES, dbDelete, dbGet, dbGetAll, dbPut } from '../indexedDBCore';
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

export async function createConversation(title = 'שיחה חדשה'): Promise<Conversation> {
  const conversation: Conversation = {
    id: generateId('conv', 5),
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
    { role: 'user', content: userMessage },
  ];

  const provider = getAIProvider();

  const chatMessages: ChatMessage[] = [];
  if (systemPrompt) {
    chatMessages.push({ role: 'system', content: systemPrompt });
  }
  chatMessages.push(...recentMessages, { role: 'user', content: userMessage });

  const response = await provider.chat(chatMessages);

  newMessages.push({ role: 'assistant', content: response });

  const updatedConversation: Conversation = {
    ...conversation,
    messages: newMessages,
    updatedAt: new Date().toISOString(),
    title: conversation.messages.length === 0 ? userMessage.slice(0, 50) : conversation.title,
  };

  await dbPut(STORES.AI_CONVERSATIONS, updatedConversation);

  return { response, conversation: updatedConversation };
}

export async function clearConversation(): Promise<void> {
  const conversation = await getCurrentConversation();
  if (conversation) {
    await dbDelete(STORES.AI_CONVERSATIONS, conversation.id);
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
}
