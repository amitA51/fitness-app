// ============================================================================
// "ניתוח מלא של המאמן" — the AI coach's review of one run, on request.
// ============================================================================
// The store rules of ExerciseTutorial apply here too: the first use explains
// what leaves the app and waits for an explicit OK (App Store 5.1.2(i)); every
// answer says it was written by AI and can be reported (Google Play's
// generative-AI policy). The review is cached per run for the browser session.

import { Sparkles } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { AiAnswerFooter } from '../../../components/ai/AiAnswerFooter';
import type { RunningCoach } from '../../../hooks/useRunningCoach';
import { grantAiShareConsent, hasAiShareConsent } from '../../../services/ai/aiConsent';
import type { RunInsight } from '../../../services/running';
import type { CardioEffort } from '../../../utils/cardio';
import { logger } from '../../../utils/logger';
import { type CachedReview, readCachedReview, writeCachedReview } from './runReviewCache';

type Phase =
  | { kind: 'idle' }
  | { kind: 'consent' }
  | { kind: 'loading' }
  | { kind: 'done'; review: CachedReview }
  | { kind: 'error'; message: string };

const FALLBACK_ERROR = 'לא הצלחנו לקבל ניתוח כרגע. נסו שוב.';

/** Markdown the model sometimes adds — the answer is shown as plain text. */
const cleanAnswer = (text: string) =>
  text
    .replace(/\*\*|__/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .trim();

interface RunAiReviewProps {
  sessionId: string;
  cacheKey: string;
  /** The running part being reviewed. */
  effort: CardioEffort;
  /** When the run happened, in words. */
  when: string;
  insights: readonly RunInsight[];
  coach: RunningCoach;
}

export function RunAiReview({
  sessionId,
  cacheKey,
  effort,
  when,
  insights,
  coach,
}: RunAiReviewProps) {
  const [phase, setPhase] = useState<Phase>(() => {
    const cached = readCachedReview(cacheKey);
    return cached ? { kind: 'done', review: cached } : { kind: 'idle' };
  });
  const requestRef = useRef(0);
  const focusStartRef = useRef(false);
  const regionRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const consentId = useId();

  // An answer that lands after the screen closed is dropped.
  useEffect(
    () => () => {
      requestRef.current += 1;
    },
    []
  );

  // Keep keyboard focus on what replaced the pressed button.
  useEffect(() => {
    if (phase.kind === 'consent') confirmRef.current?.focus();
    else if (phase.kind === 'loading') regionRef.current?.focus({ preventScroll: true });
    else if (phase.kind === 'idle' && focusStartRef.current) {
      focusStartRef.current = false;
      startRef.current?.focus();
    }
  }, [phase.kind]);

  const request = useCallback(async () => {
    const token = ++requestRef.current;
    setPhase({ kind: 'loading' });
    let humanize: (error: unknown) => string = () => FALLBACK_ERROR;
    try {
      const errors = await import('../../../services/ai/errorMessages');
      humanize = errors.humanizeAIError;
      const ai = await import('../../../services/ai/runningCoach');
      const question = ai.runForReview(effort, when, insights);
      const brief = ai.runningBrief({ ...coach, now: new Date() });
      const answer = cleanAnswer(await ai.reviewRun(question, brief));
      // Cached even if the screen closed meanwhile: the answer is paid for, and
      // opening the run again should show it instead of asking again.
      if (answer) writeCachedReview(cacheKey, { question, answer });
      if (token !== requestRef.current) return;
      setPhase(
        answer
          ? { kind: 'done', review: { question, answer } }
          : { kind: 'error', message: FALLBACK_ERROR }
      );
    } catch (error) {
      if (token !== requestRef.current) return;
      logger.ai.error('Run review failed', error);
      setPhase({ kind: 'error', message: humanize(error) });
    }
  }, [cacheKey, coach, effort, insights, when]);

  const start = () => {
    if (hasAiShareConsent('running')) void request();
    else setPhase({ kind: 'consent' });
  };

  // The button under the disclosure is the explicit permission.
  const confirm = () => {
    grantAiShareConsent('running');
    void request();
  };

  const cancel = () => {
    focusStartRef.current = true;
    setPhase({ kind: 'idle' });
  };

  const review = phase.kind === 'done' ? phase.review : null;

  return (
    <div className="run-review">
      {phase.kind === 'idle' && (
        <button ref={startRef} type="button" className="cta-secondary focus-ring" onClick={start}>
          <Sparkles size={18} aria-hidden="true" />
          ניתוח מלא של המאמן
        </button>
      )}

      {phase.kind === 'consent' && (
        <div className="run-review-consent">
          <p id={consentId}>
            כדי לנתח, נתוני הריצה שלכם (תאריכים, סוג הריצה, מרחקים, זמנים, קצב, דופק והמטרה) נשלחים
            לשירות בינה מלאכותית חיצוני. השם והמייל שלכם לא נשלחים.
          </p>
          <div className="run-review-actions">
            <button
              ref={confirmRef}
              type="button"
              className="run-review-confirm focus-ring"
              aria-describedby={consentId}
              onClick={confirm}
            >
              אישור ושליחה
            </button>
            <button type="button" className="cta-ghost focus-ring" onClick={cancel}>
              ביטול
            </button>
          </div>
        </div>
      )}

      {review && (
        <h3 className="run-review-title">
          <Sparkles size={16} aria-hidden="true" />
          ניתוח המאמן
        </h3>
      )}

      {/* Only the status and the answer speak; the footer and the error stay out
          of the polite region so nothing is announced twice. */}
      <div ref={regionRef} className="run-review-live" aria-live="polite" tabIndex={-1}>
        {phase.kind === 'loading' && (
          <>
            <div className="run-review-skeleton" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <p className="sr-only">המאמן מנתח את הריצה…</p>
          </>
        )}
        {review && (
          <p className="run-review-text" dir="auto">
            {review.answer}
          </p>
        )}
      </div>

      {review && (
        <AiAnswerFooter
          key={review.answer}
          surface="run_review"
          subject={sessionId}
          question={review.question}
          answer={review.answer}
        />
      )}

      {phase.kind === 'error' && (
        <p className="run-review-error" role="alert">
          {phase.message}
        </p>
      )}

      {phase.kind === 'error' && (
        <button type="button" className="cta-secondary focus-ring" onClick={() => void request()}>
          נסו שוב
        </button>
      )}
    </div>
  );
}
