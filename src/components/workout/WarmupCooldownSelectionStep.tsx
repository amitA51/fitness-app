// WarmupCooldownFlow — Selection step
// Extracted verbatim from WarmupCooldownFlow.tsx (pure structural split, no behavior change).

import { m } from 'framer-motion';
import type React from 'react';
import { type RoutineItem, formatTime } from './warmupCooldownData';

interface SelectionStepProps {
  type: 'warmup' | 'cooldown';
  items: RoutineItem[];
  activeItems: RoutineItem[];
  totalDuration: number;
  onToggle: (id: string) => void;
  onStart: () => void;
  onSkip: () => void;
}

const SelectionStep: React.FC<SelectionStepProps> = ({
  type,
  items,
  activeItems,
  totalDuration,
  onToggle,
  onStart,
  onSkip,
}) => {
  const title = type === 'warmup' ? 'חימום' : 'צינון';
  const subtitle = type === 'warmup' ? 'בחר תרגילי חימום' : 'בחר מתיחות לצינון';

  return (
    <m.div
      key="selection"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full"
    >
      {/* Masthead */}
      <div style={{ background: 'var(--fs-primary)', flexShrink: 0 }}>
        {/* Chapter strip */}
        <div
          className="chapter-break"
          style={{ borderBottom: '1px solid rgba(var(--text-on-navy-rgb),0.1)' }}
        >
          <span className="left" style={{ color: 'var(--fs-accent)' }}>
            {title}
          </span>
          <span className="right">
            {activeItems.length === 1
              ? `תרגיל ${type === 'warmup' ? 'חימום' : 'צינון'} אחד`
              : `${activeItems.length} תרגילי ${type === 'warmup' ? 'חימום' : 'צינון'}`}
          </span>
        </div>

        {/* Title area */}
        <div className="px-5 pt-5 pb-6">
          <h2
            className="uppercase"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: 36,
              color: 'var(--color-ink-on-dark)',
              lineHeight: 0.9,
              letterSpacing: '-0.02em',
              direction: 'ltr',
              textAlign: 'left',
            }}
          >
            {title}
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.15em',
              color: 'rgba(var(--text-on-navy-rgb),0.7)',
              textTransform: 'uppercase',
              marginTop: 8,
            }}
          >
            {subtitle}
          </p>

          {/* Total duration badge */}
          <div
            className="mt-3"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(var(--text-on-navy-rgb),0.08)',
              padding: '6px 12px',
              border: '1px solid rgba(var(--text-on-navy-rgb),0.15)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.15em',
                color: 'var(--fs-accent)',
                textTransform: 'uppercase',
              }}
            >
              {formatTime(totalDuration)}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.15em',
                color: 'rgba(var(--text-on-navy-rgb),0.7)',
                textTransform: 'uppercase',
              }}
            >
              סה״כ
            </span>
          </div>
        </div>
      </div>

      {/* Bone body */}
      <div
        className="flex-1 overflow-y-auto overscroll-contain px-5 py-4"
        style={{ background: 'var(--fs-surface)' }}
      >
        <div className="flex flex-col gap-2 pb-4">
          {items.map((item) => (
            <m.button
              key={item.id}
              onClick={() => onToggle(item.id)}
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 16px',
                background: item.selected ? 'var(--fs-surface-2)' : 'var(--fs-surface)',
                // color-border-strong, not fs-primary: in dark, fs-primary (#0a0a0a)
                // melts into the surface and the selected outline vanishes
                border: `2px solid ${item.selected ? 'var(--color-border-strong)' : 'var(--fs-surface-2)'}`,
                cursor: 'pointer',
                transition: 'all 150ms',
                minHeight: 56,
              }}
              whileTap={{ scale: 0.99 }}
            >
              <div className="flex items-center gap-3">
                {/* Checkbox */}
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 0,
                    border: `2px solid ${item.selected ? 'var(--color-border-strong)' : 'var(--fs-muted)'}`,
                    background: item.selected ? 'var(--fs-accent)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {item.selected && (
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
                      <path
                        d="M1 5L4.5 8.5L11 1"
                        stroke="var(--fs-primary)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 15,
                    // fs-ink, not fs-primary: selected-row text was #0a0a0a on
                    // #1a1a1a in dark mode (1.1:1 — the invisible-warmup bug)
                    color: item.selected ? 'var(--fs-ink)' : 'var(--fs-muted)',
                    letterSpacing: '-0.01em',
                    textAlign: 'right',
                  }}
                >
                  {item.nameHe}
                </span>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  letterSpacing: '0.1em',
                  color: item.selected ? 'var(--fs-ink)' : 'var(--fs-muted)',
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                }}
              >
                {formatTime(item.duration)}
              </span>
            </m.button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div
        className="flex flex-col gap-2 px-5 py-4"
        style={{ background: 'var(--fs-surface)', borderTop: '1px solid var(--fs-surface-2)' }}
      >
        <button
          type="button"
          onClick={onStart}
          disabled={activeItems.length === 0}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '18px 24px',
            background: 'var(--fs-primary)',
            color: 'var(--fs-accent)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            opacity: activeItems.length === 0 ? 0.5 : 1,
            transition: 'all 150ms',
            minHeight: 52,
          }}
          onPointerDown={(e) => {
            e.currentTarget.style.background = 'var(--color-primary-hover)';
          }}
          onPointerUp={(e) => {
            e.currentTarget.style.background = 'var(--fs-primary)';
          }}
          onPointerLeave={(e) => {
            e.currentTarget.style.background = 'var(--fs-primary)';
          }}
        >
          התחל {title} ({activeItems.length})
        </button>
        <button
          type="button"
          onClick={onSkip}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px 24px',
            background: 'transparent',
            color: 'var(--fs-muted)',
            border: '2px solid var(--fs-muted)',
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            transition: 'all 150ms',
            minHeight: 48,
          }}
          onPointerDown={(e) => {
            e.currentTarget.style.color = 'var(--fs-primary)';
            e.currentTarget.style.borderColor = 'var(--fs-primary)';
          }}
          onPointerUp={(e) => {
            e.currentTarget.style.color = 'var(--fs-muted)';
            e.currentTarget.style.borderColor = 'var(--fs-muted)';
          }}
          onPointerLeave={(e) => {
            e.currentTarget.style.color = 'var(--fs-muted)';
            e.currentTarget.style.borderColor = 'var(--fs-muted)';
          }}
        >
          דלג על {title}
        </button>
      </div>
    </m.div>
  );
};

export default SelectionStep;
