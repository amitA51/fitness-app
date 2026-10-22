// ============================================================================
// AiAnswerFooter — the line under every AI answer: "written by AI, may be
// wrong" and a way to report the answer (Google Play's generative-AI policy).
// ============================================================================
// Owns its own report state, so a caller only says what was asked and
// answered. Key it by the answer (`key={answer}`) when one panel shows a new
// answer in place of the old, so the report state starts fresh.

import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { logger } from '../../utils/logger';

export interface AiAnswerFooterProps {
  /** Where the answer was shown, e.g. 'exercise_qa'. */
  surface: string;
  /** What it was about, e.g. the exercise name. */
  subject?: string;
  question: string;
  answer: string;
}

type ReportState = 'idle' | 'sending' | 'sent' | 'failed';

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginTop: 12,
  paddingTop: 10,
  borderTop: '0.5px solid var(--color-separator)',
  fontFamily: 'var(--font-body)',
  fontSize: 12,
  color: 'var(--fs-muted)',
  lineHeight: 1.4,
};

export function AiAnswerFooter({ surface, subject, question, answer }: AiAnswerFooterProps) {
  const [report, setReport] = useState<ReportState>('idle');
  // The button disappears once the report is in; keyboard focus moves to the
  // thank-you line instead of being dropped onto the page.
  const sentRef = useRef<HTMLSpanElement>(null);
  const reportedFromButton = useRef(false);
  useEffect(() => {
    if (report === 'sent' && reportedFromButton.current) sentRef.current?.focus();
  }, [report]);

  const handleReport = useCallback(async () => {
    if (report === 'sending' || report === 'sent') return;
    reportedFromButton.current = document.activeElement?.tagName === 'BUTTON';
    setReport('sending');
    try {
      const { reportAiAnswer } = await import('../../services/ai/aiFeedback');
      const ok = await reportAiAnswer({ surface, subject, question, answer });
      setReport(ok ? 'sent' : 'failed');
    } catch (error) {
      // Offline, the module itself may fail to load; the button must come back.
      logger.ai.warn('AI answer report threw', error);
      setReport('failed');
    }
  }, [answer, question, report, subject, surface]);

  return (
    <>
      <div style={rowStyle}>
        <span>התשובה נכתבה בבינה מלאכותית ועלולה לטעות.</span>
        {report === 'sent' ? (
          <span role="status" ref={sentRef} tabIndex={-1} style={{ outline: 'none' }}>
            תודה, הדיווח התקבל.
          </span>
        ) : (
          <button
            type="button"
            onClick={handleReport}
            disabled={report === 'sending'}
            aria-busy={report === 'sending'}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
            style={{
              flexShrink: 0,
              // Full touch target although the text is small.
              minHeight: 44,
              padding: '0 4px',
              background: 'none',
              border: 'none',
              color: 'var(--fs-link)',
              textDecoration: 'underline',
              textUnderlineOffset: 2,
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              cursor: report === 'sending' ? 'default' : 'pointer',
            }}
          >
            {report === 'sending' ? 'שולחים…' : 'דיווח על התשובה'}
          </button>
        )}
      </div>
      {report === 'failed' && (
        <p
          role="alert"
          style={{
            margin: '8px 0 0',
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--fs-error)',
          }}
        >
          הדיווח לא נשלח. נסו שוב.
        </p>
      )}
    </>
  );
}

export default AiAnswerFooter;
