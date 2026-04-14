// ============================================================================
// SPARKOS FITNESS - AI Coach Service (Facade)
// Delegates to the new AI infrastructure in ./ai/
// ============================================================================

export { type ChatMessage, type AIProvider, type AIConfig, getAIProvider, setAIProvider, resetAIProvider } from './ai/core';
export { type AIContext, buildContext, buildSystemPrompt } from './ai/contextBuilder';
export { getWorkoutAdvice, suggestWeight, suggestExercises, generateWorkoutSummary, getFormTips } from './ai/features';
export { type Conversation, createConversation, getCurrentConversation, getOrCreateConversation, sendMessage, clearConversation, getAllConversations, deleteConversation } from './ai/chat';

// Legacy type aliases for backward compatibility
export type AICoachMessage = import('./ai/core').ChatMessage;
export type ExerciseChatMessage = AICoachMessage;

export interface AIExerciseTip {
  exerciseId: string;
  tips: string[];
}

// Additional backward-compatible functions for components that still use the old API

import { getAIProvider, type ChatMessage } from './ai/core';
import { getFormTips } from './ai/features';

export async function getExerciseTutorial(exerciseName: string): Promise<string | null> {
  const tips = await getFormTips(exerciseName);
  if (tips.length === 0) return null;
  return `**${exerciseName}**\n\n${tips.map(t => '• ' + t).join('\n')}`;
}

export async function askExerciseQuestion(
  exerciseName: string,
  question: string,
  _history?: ExerciseChatMessage[]
): Promise<string> {
  const provider = getAIProvider();
  const messages: ChatMessage[] = [
    { role: 'system', content: 'אתה מאמן כושר מקצועי. ענה בעברית בקצרה ובמעשיות.' },
    { role: 'user', content: `שאלה על ${exerciseName}: ${question}` },
  ];
  return provider.chat(messages);
}
