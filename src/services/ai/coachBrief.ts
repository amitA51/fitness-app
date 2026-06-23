// ============================================================================
// Coach Brief — the structured, model-ready AI contract
// ============================================================================
//
// THE ANTI-HALLUCINATION CONTRACT
// A CoachBrief is split in two:
//   - `facts`: deterministic numbers computed in TypeScript (readiness, volume,
//     recommendation, weak muscles, ...). The UI renders THESE as the hero
//     numbers. The model never produces them.
//   - `headline` / `detail`: short prose. When a real LLM is configured it only
//     *phrases* an explanation over the facts; otherwise a deterministic template
//     (math-consistent) is used. Either way the displayed numbers come from `facts`.
//
// THE MODEL-READY SEAM
// `generateCoachBrief` asks the provider for strict JSON {headline, detail}. A real
// model slots in here with no other change: numbers stay grounded, output is
// validated, and any failure falls back to the deterministic template. This is
// how the AI takes a broad role without inventing weights/scores.
// ============================================================================

import type { MacroNutrients, WorkoutSession } from '../../types';
import type { RecoveryLog } from '../bodyStatsService';
import { type AIContext, buildContext, buildSystemPrompt } from './contextBuilder';
import { type ChatMessage, getAIProvider } from './core';

export type CoachBriefKind = 'daily-readiness' | 'weekly-review';
export type BriefConfidence = 'high' | 'medium' | 'low';

export interface CoachBriefFacts {
  readinessScore: number;
  readinessLabel: AIContext['readinessLabel'];
  recommendation: AIContext['trainingLoadRecommendation'];
  primaryConstraint: AIContext['primaryConstraint'];
  fatigueScore: number;
  weeklyVolume: number;
  volumeChangePercent: number;
  acuteChronicRatio: number;
  recoveryScore: number | null;
  streakDays: number;
  weakMuscles: string[];
  neglectedMuscles: string[];
  nutritionSummary: string | null;
  confidence: BriefConfidence;
}

export interface CoachBrief {
  kind: CoachBriefKind;
  /** Deterministic — render these numbers directly; never let the model set them. */
  facts: CoachBriefFacts;
  /** Short factual headline (model-phrased or deterministic template). */
  headline: string;
  /** 1-3 sentence explanation grounded in `facts`. */
  detail: string;
  /** Whether an LLM phrased the prose or the deterministic template was used. */
  source: 'ai' | 'deterministic';
}

export interface CoachBriefInput {
  sessions: WorkoutSession[];
  recoveryLogs?: RecoveryLog[];
  nutritionData?: { dailyAverage: MacroNutrients; goal: MacroNutrients };
}

const REC_HEADLINE: Record<AIContext['trainingLoadRecommendation'], string> = {
  push: 'אפשר להעלות עומס',
  maintain: 'שמור על העומס',
  deload: 'אימון קל (דלואד)',
  rest: 'יום מנוחה',
};

const CONSTRAINT_REASON: Record<AIContext['primaryConstraint'], string> = {
  recovery: 'ההתאוששות נמוכה',
  load_spike: 'קפיצת עומס חדה השבוע',
  high_rpe: 'ה-RPE הממוצע גבוה',
  low_volume: 'אין נפח אימון השבוע',
  balanced: 'העומס מאוזן',
};

function deriveConfidence(ds: AIContext['dataSufficiency']): BriefConfidence {
  const signals = [ds.hasRpe, ds.hasRecovery, ds.hasChronicBaseline].filter(Boolean).length;
  if (ds.sessionCount < 3) return 'low';
  if (signals >= 3 && ds.profileCompleteness >= 0.5) return 'high';
  if (signals <= 1) return 'low';
  return 'medium';
}

function factsFromContext(context: AIContext): CoachBriefFacts {
  return {
    readinessScore: context.readinessScore,
    readinessLabel: context.readinessLabel,
    recommendation: context.trainingLoadRecommendation,
    primaryConstraint: context.primaryConstraint,
    fatigueScore: context.fatigueScore,
    weeklyVolume: context.weeklyVolume,
    volumeChangePercent: context.volumeChangePercent,
    acuteChronicRatio: context.acuteChronicRatio,
    recoveryScore: context.recoveryScore,
    streakDays: context.streakDays,
    weakMuscles: context.weakMuscles,
    neglectedMuscles: context.neglectedMuscles,
    nutritionSummary: context.nutrition ? context.nutrition.summary : null,
    confidence: deriveConfidence(context.dataSufficiency),
  };
}

/**
 * Synchronous facts only — the deterministic numbers, no provider call. Lets the
 * UI render the hero numbers instantly while the prose is phrased asynchronously.
 */
export function buildCoachFacts(input: CoachBriefInput): CoachBriefFacts {
  const context = buildContext(input.sessions, input.recoveryLogs ?? [], input.nutritionData);
  return factsFromContext(context);
}

/** Deterministic, math-consistent prose used as the fallback (and as the LLM's
 * grounding reference). Never contradicts `facts`. Exported so the card's
 * pre-resolve / AI-failure fallback reuses this exact qualitative prose instead
 * of re-deriving a number-restating caption. */
export function deterministicProse(
  kind: CoachBriefKind,
  f: CoachBriefFacts
): {
  headline: string;
  detail: string;
} {
  if (kind === 'weekly-review') {
    const sign = f.volumeChangePercent >= 0 ? '+' : '';
    const headline = `נפח שבועי ${f.weeklyVolume.toLocaleString()} ק"ג · ${sign}${f.volumeChangePercent}% מהשבוע שעבר`;
    const bits: string[] = [];
    // Streak is intentionally NOT restated here — the dedicated WorkoutStreak
    // chip on the home owns that number; this caption stays qualitative.
    if (f.weakMuscles.length > 0)
      bits.push(`שרירים חלשים: ${f.weakMuscles.slice(0, 3).join(', ')}`);
    if (f.neglectedMuscles.length > 0)
      bits.push(`מוזנחים: ${f.neglectedMuscles.slice(0, 3).join(', ')}`);
    if (f.nutritionSummary) bits.push(f.nutritionSummary);
    const detail =
      bits.length > 0 ? bits.join('. ') : 'המשך לתעד אימונים כדי לקבל סקירה מפורטת יותר.';
    return { headline, detail };
  }

  // daily-readiness
  const headline = `מוכנות ${f.readinessScore}/100 · ${REC_HEADLINE[f.recommendation]}`;
  const reason = CONSTRAINT_REASON[f.primaryConstraint];
  let detail: string;
  switch (f.recommendation) {
    case 'rest':
      detail = `עומס מצטבר גבוה (עייפות ${f.fatigueScore}/100). ${reason}. עדיף יום מנוחה.`;
      break;
    case 'deload':
      detail = `${reason}. בצע אימון קל — הורד בערך 15-20% מהעומס ושמור על טכניקה.`;
      break;
    case 'maintain':
      detail = `${reason}. שמור על העומס הנוכחי והתמקד בביצוע נקי לפני העלאה.`;
      break;
    default:
      detail = `${reason}. אפשר להעלות עומס בהדרגה תוך שמירה על טכניקה.`;
  }
  if (f.confidence === 'low') {
    detail += ' (נתונים חלקיים — רשום RPE והתאוששות לדיוק רב יותר.)';
  }
  return { headline, detail };
}

/** Tolerant extraction of a {headline, detail} JSON object from a model reply. */
function parseBriefJson(text: string): { headline: string; detail: string } | null {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    const parsed = JSON.parse(text.slice(start, end + 1)) as {
      headline?: unknown;
      detail?: unknown;
    };
    const headline = typeof parsed.headline === 'string' ? parsed.headline.trim() : '';
    const detail = typeof parsed.detail === 'string' ? parsed.detail.trim() : '';
    if (!headline && !detail) return null;
    return { headline: headline.slice(0, 120), detail: detail.slice(0, 400) };
  } catch {
    return null;
  }
}

/**
 * Build a CoachBrief. The numbers are always deterministic; the prose is phrased
 * by the configured AI provider when possible, otherwise by the math-consistent
 * template. Never throws — always returns a usable brief.
 */
export async function generateCoachBrief(
  kind: CoachBriefKind,
  input: CoachBriefInput
): Promise<CoachBrief> {
  const context = buildContext(input.sessions, input.recoveryLogs ?? [], input.nutritionData);
  const facts = factsFromContext(context);
  const fallback = deterministicProse(kind, facts);

  // No sessions yet → deterministic only (nothing for the model to phrase).
  if (input.sessions.length === 0) {
    return {
      kind,
      facts,
      headline: fallback.headline,
      detail: fallback.detail,
      source: 'deterministic',
    };
  }

  try {
    const provider = getAIProvider();
    const task =
      kind === 'weekly-review'
        ? 'נסח סקירה שבועית קצרה (משפט-שניים) על בסיס הנתונים שסופקו.'
        : 'נסח המלצת אימון יומית קצרה (משפט-שניים) על בסיס הנתונים שסופקו.';
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `${buildSystemPrompt(context)}\n\nהחזר JSON בלבד בפורמט: {"headline":"כותרת קצרה","detail":"הסבר קצר"}. אל תמציא מספרים — השתמש רק במספרים שסופקו.`,
      },
      { role: 'user', content: task },
    ];
    const response = await provider.chat(messages);
    const parsed = parseBriefJson(response);
    if (parsed) {
      return {
        kind,
        facts,
        headline: parsed.headline || fallback.headline,
        detail: parsed.detail || fallback.detail,
        source: 'ai',
      };
    }
    // Non-JSON reply (e.g. local fallback): treat a non-empty line as the detail,
    // but keep the deterministic headline so the numbers stay clean.
    const line = response.trim();
    if (line) {
      return { kind, facts, headline: fallback.headline, detail: line.slice(0, 400), source: 'ai' };
    }
  } catch {
    // fall through to deterministic
  }

  return {
    kind,
    facts,
    headline: fallback.headline,
    detail: fallback.detail,
    source: 'deterministic',
  };
}
