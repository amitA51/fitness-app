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

export async function getExerciseTutorial(exerciseName: string): Promise<string | null> {
  const tips = await getFormTips(exerciseName);
  if (tips.length === 0) return null;
  return `**${exerciseName}**\n\n${tips.map((t) => '• ' + t).join('\n')}`;
}

export async function askExerciseQuestion(
  exerciseName: string,
  question: string,
  history?: ExerciseChatMessage[]
): Promise<string> {
  const provider = getAIProvider();
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `תתייחס לשאלה שמתייחסת לתרגיל: ${exerciseName}. ענה קצר ומעשי.`,
    },
    ...(history ?? []),
    { role: 'user', content: question },
  ];
  return provider.chat(messages);
}
