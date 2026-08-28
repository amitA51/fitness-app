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
  const subtitle = type === 'warmup' ? 'בחרו תרגילי חימום' : 'בחרו מתיחות לצינון';

  return (
    <m.div
      key="selection"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col h-full"
      // The overlay is fixed inset-0, so without a cap the rows measured 1240px
      // wide at desktop. --max-width is the app-wide 480px column.
      style={{ maxWidth: 'var(--max-width)', marginInline: 'auto', width: '100%' }}
    >
      {/* Masthead */}
      <div style={{ background: 'var(--fs-primary)', flexShrink: 0 }}>
        {/* Data rail — how many and how long. The title is NOT repeated here:
            it already sits 40px below as the h2, and the dialog is labelled
            "חימום" for screen readers. */}
        <div
          className="chapter-break"
          style={{ borderBottom: '1px solid rgba(var(--text-on-navy-rgb),0.1)' }}
        >
          <span className="left" dir="ltr" style={{ color: 'var(--fs-accent)' }}>
            {formatTime(totalDuration)}
          </span>
          <span className="right">
            {activeItems.length === 1
              ? `תרגיל ${type === 'warmup' ? 'חימום' : 'צינון'} אחד`
              : `${activeItems.length} תרגילי ${type === 'warmup' ? 'חימום' : 'צינון'}`}
          </span>
        </div>

        {/* Title area */}
        <div className="px-5 pt-5 pb-5">
          {/* No direction/text-align override: the Hebrew title must follow the
              document's RTL flow and sit at the start edge, in line with the
              subtitle below it. Hardcoding ltr/left pinned it to the far side. */}
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 36,
              color: 'var(--color-ink-on-dark)',
              lineHeight: 0.9,
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </h2>
          {/* font-body, not font-mono: this is a Hebrew sentence, and mono is
              reserved for sparse micro labels. */}
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'rgba(var(--text-on-navy-rgb),0.7)',
              marginTop: 10,
            }}
          >
            {subtitle}
          </p>
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
                    borderRadius: 12,
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
                    fontWeight: 600,
                    fontSize: 15,
                    // fs-ink, not fs-primary: selected-row text was #0a0a0a on
                    // #1a1a1a in dark mode (1.1:1 — the invisible-warmup bug)
                    color: item.selected ? 'var(--fs-ink)' : 'var(--fs-muted)',
                    letterSpacing: '-0.01em',
                    textAlign: 'start',
                  }}
                >
                  {item.nameHe}
                </span>
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  letterSpacing: '-0.01em',
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
            // btn-primary-*, not fs-primary/fs-accent: fs-primary is #0a0a0a in
            // dark and the fill measured 1.05:1 against the #111 surface — the
            // CTA had no visible edge. This token pair inverts in dark (mint
            // fill, dark ink) and is identical to the old values in light.
            background: 'var(--btn-primary-bg)',
            color: 'var(--btn-primary-text)',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: 15,
            letterSpacing: '-0.01em',
            opacity: activeItems.length === 0 ? 0.5 : 1,
            transition: 'opacity 150ms var(--ease-out)',
            minHeight: 52,
          }}
          // Press feedback via opacity so it reads the same in both themes; a
          // background swap needed a token that flips polarity in dark.
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
          התחילו {title}
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
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: '-0.01em',
            transition: 'color 150ms var(--ease-out), border-color 150ms var(--ease-out)',
            minHeight: 48,
          }}
          // fs-ink, not fs-primary: fs-primary is near-black in dark, so pressing
          // this button used to make it disappear into the surface.
          onPointerDown={(e) => {
            e.currentTarget.style.color = 'var(--fs-ink)';
            e.currentTarget.style.borderColor = 'var(--fs-ink)';
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
          דלגו על {title}
        </button>
      </div>
    </m.div>
  );
};

export default SelectionStep;
