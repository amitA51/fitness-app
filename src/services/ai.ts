// ============================================================================
// SPARKOS FITNESS - AI Coach Service (Facade)
// Delegates to the new AI infrastructure in ./ai/
// ============================================================================

export {
  type ChatMessage,
  type AIProvider,
  type AIConfig,
  type AIErrorCode,
  AIError,
  LocalFallbackProvider,
  RemoteProvider,
  getAIProvider,
  setAIProvider,
  resetAIProvider,
} from './ai/core';
export { initAI } from './ai/bootstrap';
export { type AIContext, buildContext, buildSystemPrompt } from './ai/contextBuilder';
export {
  getWorkoutAdvice,
  suggestWeight,
  suggestExercises,
  generateWorkoutSummary,
  getFormTips,
} from './ai/features';
export {
  type Conversation,
  createConversation,
  getCurrentConversation,
  getOrCreateConversation,
  sendMessage,
  clearConversation,
  getAllConversations,
  deleteConversation,
} from './ai/chat';

// Legacy type aliases for backward compatibility
export type AICoachMessage = import('./ai/core').ChatMessage;
export type ExerciseChatMessage = AICoachMessage;

export interface AIExerciseTip {
  exerciseId: string;
  tips: string[];
}

// Additional backward-compatible functions for components that still use the old API

import { type ChatMessage, getAIProvider } from './ai/core';
import { getFormTips } from './ai/features';

/** Sanitize user-provided text before embedding in prompts. */
export function sanitizeForPrompt(input: string, maxLength = 100): string {
  return input
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[^\p{L}\p{N}\p{Zs}\-_'"()]/gu, '')
    .slice(0, maxLength)
    .trim();
}

export async function getExerciseTutorial(exerciseName: string): Promise<string | null> {
  const tips = await getFormTips(exerciseName);
  if (tips.length === 0) return null;
  const safeName = sanitizeForPrompt(exerciseName);
  return `**${safeName}**\n\n${tips.map((t) => `• ${t}`).join('\n')}`;
}

export async function askExerciseQuestion(
  exerciseName: string,
  question: string,
  history?: ExerciseChatMessage[]
): Promise<string> {
  const provider = getAIProvider();
  const safeName = sanitizeForPrompt(exerciseName);
  const safeQuestion = sanitizeForPrompt(question, 500);
  // Cap history to avoid unbounded token cost
  const cappedHistory = (history ?? []).slice(-20);
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `תתייחס לשאלה שמתייחסת לתרגיל: ${safeName}. ענה קצר ומעשי.`,
    },
    ...cappedHistory,
    { role: 'user', content: safeQuestion },
  ];
  return provider.chat(messages);
}
