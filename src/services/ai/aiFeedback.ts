// ============================================================================
// Reporting an AI answer
// ============================================================================
// Google Play's generative-AI policy requires a way to flag an AI answer from
// inside the app. A report is one row in ai_feedback (insert-only for the
// signed-in user, read from the dashboard) holding what was asked and answered.

import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';

export interface AiAnswerReport {
  /** Where the answer was shown, e.g. 'exercise_qa'. */
  surface: string;
  /** What it was about, e.g. the exercise name. */
  subject?: string;
  question: string;
  answer: string;
}

/** True when the report reached the server. */
export async function reportAiAnswer(report: AiAnswerReport): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from('ai_feedback').insert({
    surface: report.surface.slice(0, 40),
    subject: report.subject ? report.subject.slice(0, 200) : null,
    question: report.question.slice(0, 1000),
    answer: report.answer.slice(0, 8000),
  });
  if (error) {
    logger.ai.warn('AI answer report failed', error);
    return false;
  }
  return true;
}
