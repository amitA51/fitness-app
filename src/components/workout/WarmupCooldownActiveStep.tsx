// WarmupCooldownFlow — Active (timer) step
// Extracted verbatim from WarmupCooldownFlow.tsx (pure structural split, no behavior change).

import { m } from 'framer-motion';
import type React from 'react';
import { type RoutineItem, formatTime } from './warmupCooldownData';

interface ActiveStepProps {
  type: 'warmup' | 'cooldown';
  currentItem: RoutineItem | undefined;
  currentIndex: number;
  totalItems: number;
  timeLeft: number;
  isPaused: boolean;
  progress: number;
  isWarning: boolean;
  onTogglePause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSkipAll: () => void;
  isLast: boolean;
}

const ActiveStep: React.FC<ActiveStepProps> = ({
  type,
  currentItem,
  currentIndex,
  totalItems,
  timeLeft,
  isPaused,
  progress,
  isWarning,
  onTogglePause,
  onPrev,
  onNext,
  onSkipAll,
  isLast,
}) => {
  const title = type === 'warmup' ? 'חימום' : 'צינון';

  const timerColor = isWarning ? 'var(--fs-warn)' : 'var(--fs-accent)';

  return (
    <m.div
      key="active"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col"
      // Without a cap the fixed inset-0 overlay stretched the nav row across the
      // full desktop width. --max-width is the app-wide 480px column.
      style={{
        height: '100%',
        background: 'var(--fs-surface)',
        maxWidth: 'var(--max-width)',
        marginInline: 'auto',
        width: '100%',
      }}
    >
      {/* Navy header strip */}
      <div
        style={{
          background: 'var(--fs-primary)',
          // 6px block padding + a 44px tap target = a 56px strip. The old
          // 16px/20px padding with a zero-padding button gave a 14.7px target.
          padding: '6px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span
          dir="ltr"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '-0.01em',
            color: 'var(--fs-accent)',
            paddingInline: 12,
          }}
        >
          {currentIndex + 1} / {totalItems}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: '-0.01em',
            // 0.5 alpha measured 4.36:1 on the light navy — under AA. 0.72 clears it.
            color: 'rgba(var(--text-on-navy-rgb),0.72)',
          }}
        >
          {title}
        </span>
        <button
          type="button"
          onClick={onSkipAll}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(var(--text-on-navy-rgb),0.7)',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            letterSpacing: '-0.01em',
            minHeight: 44,
            paddingInline: 12,
          }}
        >
          דלגו על הכל
        </button>
      </div>

      {/* Exercise name */}
      <div
        className="text-center"
        style={{
          padding: '24px 20px 0',
          background: 'var(--fs-surface)',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            letterSpacing: '-0.01em',
            color: 'var(--fs-muted)',
          }}
        >
          {type === 'warmup' ? 'תרגיל' : 'מתיחה'}
        </span>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 28,
            color: 'var(--fs-heading)',
            lineHeight: 1,
            letterSpacing: '-0.02em',
            marginTop: 8,
          }}
        >
          {currentItem?.nameHe}
        </h2>
      </div>

      {/* Timer — massive editorial number */}
      <div
        className="flex-1 flex items-center justify-center"
        style={{ background: 'var(--fs-surface)', minHeight: 0 }}
        role="button"
        tabIndex={0}
        aria-label={isPaused ? 'המשך' : 'השהיה'}
        aria-pressed={isPaused}
        onClick={onTogglePause}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onTogglePause();
          }
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 'min(240px, 60vw)',
            height: 'min(240px, 60vw)',
          }}
        >
          {/* SVG progress ring */}
          <svg
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              transform: 'rotate(-90deg)',
            }}
            viewBox="0 0 240 240"
          >
            {/* Track */}
            <circle
              cx="120"
              cy="120"
              r="108"
              stroke="var(--fs-surface-2)"
              strokeWidth="6"
              fill="none"
            />
            {/* Progress */}
            <circle
              cx="120"
              cy="120"
              r="108"
              stroke={timerColor}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 108}
              strokeDashoffset={2 * Math.PI * 108 * (1 - progress / 100)}
              style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
            />
          </svg>

          {/* Time + label */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <m.span
              key={timeLeft}
              initial={{ scale: 1.08 }}
              animate={{ scale: 1 }}
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 'clamp(48px, 14vw, 72px)',
                // fs-heading, not fs-primary. fs-primary is #0a0a0a in dark and
                // this number measured 1.05:1 on the #111 surface — the single
                // largest element on the screen was invisible. fs-heading is the
                // same #16292d in light and flips to #f0f0f0 in dark. It is also
                // what the exercise name above already uses.
                color: isWarning ? 'var(--fs-warn)' : 'var(--fs-heading)',
                letterSpacing: '-0.03em',
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatTime(timeLeft)}
            </m.span>
            {isPaused && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '-0.01em',
                  color: 'var(--fs-muted)',
                  marginTop: 6,
                }}
              >
                מושהה
              </span>
            )}
            {timeLeft === 0 && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  letterSpacing: '-0.01em',
                  color: 'var(--color-success)',
                  marginTop: 6,
                }}
              >
                הושלם!
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div
        style={{
          padding: '0 20px 24px',
          background: 'var(--fs-surface)',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            // font-body 12, not mono 9: this is a Hebrew sentence, and 9px is
            // below the smallest size in the type scale.
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: 'var(--fs-muted)',
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          לחצו על השעון להשהייה או המשך
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={currentIndex === 0}
            style={{
              width: 52,
              height: 52,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--fs-surface-2)',
              // fs-ink / color-border-strong, not fs-primary: fs-primary is
              // #0a0a0a in dark, so both the glyph and the 2px border measured
              // ~1.25:1 on the #262626 fill and vanished.
              color: currentIndex === 0 ? 'var(--fs-muted)' : 'var(--fs-ink)',
              border: '2px solid var(--color-border-strong)',
              borderRadius: 12,
              cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 18,
              opacity: currentIndex === 0 ? 0.5 : 1,
              // Disabled state changes color and opacity only. Keeping the list explicit
              // prevents a navigation control from animating incidental layout changes.
              transition:
                'background 150ms var(--ease-out), color 150ms var(--ease-out), opacity 150ms var(--ease-out)',
            }}
            aria-label="תרגיל קודם"
          >
            {/* RTL: "previous" moves backward, which points right */}→
          </button>

          <button
            type="button"
            onClick={onNext}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px 24px',
              // btn-primary-*: fs-primary fill measured 1.05:1 against the dark
              // surface, so the primary CTA had no visible edge. Identical values
              // in light; inverts to a mint fill in dark.
              background: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-text)',
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 15,
              letterSpacing: '-0.01em',
              transition: 'opacity 150ms var(--ease-out)',
              minHeight: 52,
            }}
            onPointerDown={(e) => {
              e.currentTarget.style.opacity = '0.85';
            }}
            onPointerUp={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
            onPointerLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            {isLast ? 'סיום' : 'הבא ←'}
          </button>
        </div>
      </div>
    </m.div>
  );
};

export default ActiveStep;
