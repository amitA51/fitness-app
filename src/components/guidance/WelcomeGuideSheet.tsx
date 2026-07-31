// WelcomeGuideSheet — one-time first-use guidance, four paged steps on top of
// the canonical <Sheet>. Sheet (→ ModalOverlay) already provides the focus
// trap, scroll lock, Esc-to-close, backdrop dismiss and prefers-reduced-motion
// handling, so this component only owns the paging + content.
//
// Dismissal (any of: finish, skip, Esc, backdrop, close button) marks the
// welcome as seen via the context so it never auto-opens again.

import { ChevronLeft, ChevronRight } from 'lucide-react';
// RTL note: in Hebrew "next" points LEFT and "back" points RIGHT — Back uses
// ChevronRight, Next/Finish uses ChevronLeft (mirrors OnboardingFlow).
import { useEffect, useState } from 'react';
import { useGuidance } from '../../contexts/GuidanceContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { Button } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { GUIDANCE_STEPS, WELCOME_SHEET_TITLE } from './guidanceSteps';

const TOTAL = GUIDANCE_STEPS.length;

export function WelcomeGuideSheet() {
  const { isWelcomeOpen, closeWelcomeAndMark } = useGuidance();
  const reduceMotion = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);

  // Always start a fresh open (initial first-use OR a Settings re-launch) at the
  // first step, regardless of where a previous viewing left off.
  useEffect(() => {
    if (isWelcomeOpen) setStepIndex(0);
  }, [isWelcomeOpen]);

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === TOTAL - 1;
  const step = GUIDANCE_STEPS[stepIndex];
  if (!step) return null;
  const StepIcon = step.icon;

  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));
  const goNext = () => {
    if (isLast) {
      closeWelcomeAndMark();
      return;
    }
    setStepIndex((i) => Math.min(TOTAL - 1, i + 1));
  };

  const footer = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {/* Step dots + counter */}
      <div className="flex items-center justify-between gap-3">
        <div
          className="flex items-center gap-2"
          role="img"
          aria-label={`שלב ${stepIndex + 1} מתוך ${TOTAL}`}
        >
          {/* The logical margin reserves each selected pill's final footprint in one
              state update; only the visual scale/color transition runs per frame, avoiding
              repeated width layout while keeping the RTL inline expansion direction. */}
          {GUIDANCE_STEPS.map((s, i) => {
            const isActive = i === stepIndex;
            return (
              <span
                key={s.title}
                aria-hidden="true"
                style={{
                  width: 7,
                  height: 7,
                  display: 'block',
                  flexShrink: 0,
                  marginInlineEnd: isActive ? 13 : 0,
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    borderRadius: 'var(--radius-full)',
                    background: isActive ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
                    transform: `scaleX(${isActive ? 20 / 7 : 1})`,
                    transformOrigin: 'var(--progress-fill-origin-inline-start)',
                    transition: reduceMotion
                      ? 'none'
                      : 'transform 150ms ease, background 150ms ease',
                  }}
                />
              </span>
            );
          })}
        </div>
        <span
          dir="ltr"
          className="kinetic-number"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '-0.01em',
            color: 'var(--fs-muted)',
          }}
        >
          {stepIndex + 1} / {TOTAL}
        </span>
      </div>

      {/* Navigation row */}
      <div className="flex items-center gap-3">
        {!isFirst && (
          <Button
            variant="secondary"
            onClick={goBack}
            aria-label="חזרה לשלב הקודם"
            className="shrink-0"
          >
            <ChevronRight size={18} aria-hidden="true" />
            חזרה
          </Button>
        )}
        <Button variant="primary" onClick={goNext} fullWidth className="flex-1">
          {isLast ? 'הבנתי — בואו נתחיל' : 'הבא'}
          {!isLast && <ChevronLeft size={18} aria-hidden="true" />}
        </Button>
      </div>

      {/* Skip — present on every step, low emphasis */}
      <Button variant="ghost" onClick={closeWelcomeAndMark} fullWidth>
        דילוג
      </Button>
    </div>
  );

  return (
    <Sheet
      isOpen={isWelcomeOpen}
      onClose={closeWelcomeAndMark}
      title={WELCOME_SHEET_TITLE}
      ariaLabel={WELCOME_SHEET_TITLE}
      footer={footer}
    >
      <div
        className="flex flex-col items-center text-center"
        style={{ gap: 'var(--space-4)', paddingBlock: 'var(--space-2)' }}
      >
        {/* Icon badge */}
        <div
          aria-hidden="true"
          className="flex items-center justify-center shrink-0"
          style={{
            width: 72,
            height: 72,
            background: 'var(--fs-primary)',
            borderRadius: 'var(--radius-asymmetric)',
            color: 'var(--fs-accent)',
          }}
        >
          <StepIcon size={34} strokeWidth={2} aria-hidden="true" />
        </div>

        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 'var(--text-headline)',
            color: 'var(--fs-heading)',
            margin: 0,
          }}
        >
          {step.title}
        </h3>

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            lineHeight: 1.6,
            color: 'var(--fs-muted)',
            maxWidth: '34ch',
            margin: 0,
          }}
        >
          {step.body}
        </p>
      </div>
    </Sheet>
  );
}

export default WelcomeGuideSheet;
