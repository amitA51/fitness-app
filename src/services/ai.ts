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

import type { WorkoutSession } from '../types';
import { oneRepMax } from '../utils/workoutMath';
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

/**
 * Build a deterministic grounding line for an exercise from the user's history:
 * the most recent completed set and its estimated 1RM (canonical Epley). Feeding
 * these REAL numbers to the model — with an explicit "don't invent numbers"
 * instruction — keeps per-exercise Q&A grounded instead of hallucinated (AW-2).
 */
export function buildExerciseGrounding(
  exerciseName: string,
  sessions: WorkoutSession[]
): string | undefined {
  const completed = sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  for (const session of completed) {
    for (const exercise of session.exercises) {
      if (exercise.exerciseName !== exerciseName) continue;
      let bestWeight = 0;
      let bestReps = 0;
      let best1RM = 0;
      for (const set of exercise.sets) {
        if (set.isCompleted && !set.isWarmup && set.weight > 0 && set.reps > 0) {
          const est = oneRepMax(set.weight, set.reps);
          if (est > best1RM) {
            best1RM = est;
            bestWeight = set.weight;
            bestReps = set.reps;
          }
        }
      }
      if (best1RM > 0) {
        return `אחרון: ${bestWeight} ק"ג x ${bestReps} · 1RM משוער ${best1RM} ק"ג`;
      }
    }
  }
  return undefined;
}

export async function askExerciseQuestion(
  exerciseName: string,
  question: string,
  options?: { grounding?: string; history?: ExerciseChatMessage[] }
): Promise<string> {
  const provider = getAIProvider();
  const safeName = sanitizeForPrompt(exerciseName);
  const safeQuestion = sanitizeForPrompt(question, 500);
  const safeGrounding = options?.grounding ? sanitizeForPrompt(options.grounding, 160) : '';
  // Cap history to avoid unbounded token cost
  const cappedHistory = (options?.history ?? []).slice(-20);
  // Inject the deterministic numbers (when available) and forbid inventing any —
  // so a numeric answer is grounded in the user's real data, not fabricated (AW-2).
  const systemContent = safeGrounding
    ? `תתייחס לשאלה שמתייחסת לתרגיל: ${safeName}. נתוני המשתמש (התבסס עליהם, אל תמציא מספרים אחרים): ${safeGrounding}. ענה קצר ומעשי.`
    : `תתייחס לשאלה שמתייחסת לתרגיל: ${safeName}. ענה קצר ומעשי. אל תמציא מספרים ספציפיים אם אין לך נתונים.`;
  const messages: ChatMessage[] = [
    { role: 'system', content: systemContent },
    ...cappedHistory,
    { role: 'user', content: safeQuestion },
  ];
  return provider.chat(messages);
}
