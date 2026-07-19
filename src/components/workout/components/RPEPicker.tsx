// RPEPicker — rate-of-perceived-exertion picker, built on the foundation
// <Sheet>. Migrated off the bespoke fixed m.div backdrop + popover (and its
// hand-rolled focus trap / backdrop handler): the drag handle, header, scroll
// body, safe-area, focus trap, Esc + backdrop dismissal now come from Sheet.
// Behavior is unchanged: tapping a value auto-selects (no confirm button),
// arrow keys move the radio selection, tags are local annotations.

import { m } from 'framer-motion';
import { memo, useCallback, useEffect, useState } from 'react';
import { useHapticFeedback } from '../../../hooks/useHapticFeedback';
import type { RpeTag } from '../../../types';
import { Sheet } from '../../ui/Sheet';

interface RPEPickerProps {
  isOpen: boolean;
  currentValue: number | null | undefined;
  targetRPE?: string;
  /** Persisted set tag (hydrates the tag row when reopened). */
  currentTag?: RpeTag | null;
  onSelect: (rpe: number | null) => void;
  /** Persist the chosen set tag; without it the tag row is a no-op. */
  onSelectTag?: (tag: RpeTag | null) => void;
  onClose: () => void;
}

const RPE_VALUES = [6, 7, 8, 9, 10];

const RPE_TAGS: { label: string; value: RpeTag }[] = [
  { label: 'טכניקה נקייה', value: 'clean' },
  { label: 'כמעט כשל', value: 'near-failure' },
  { label: 'כאב', value: 'pain' },
  { label: 'להוריד עומס', value: 'deload' },
];

const RPE_LABELS: Record<number, string> = {
  6: 'בינוני-קשה',
  7: 'קשה',
  8: 'קשה מאוד',
  9: 'כמעט מקסימלי',
  10: 'מקסימלי!',
};

const RPEPicker = memo<RPEPickerProps>(
  ({ isOpen, currentValue, targetRPE, currentTag, onSelect, onSelectTag, onClose }) => {
    const [selected, setSelected] = useState<number | null>(currentValue ?? null);
    const [selectedTag, setSelectedTag] = useState<RpeTag | null>(currentTag ?? null);
    const haptics = useHapticFeedback();

    // Sync selected value + tag when they change or the picker opens (so a saved
    // tag re-hydrates instead of resetting — the bug this fixes).
    useEffect(() => {
      if (isOpen) {
        setSelected(currentValue ?? null);
        setSelectedTag(currentTag ?? null);
      }
    }, [currentValue, currentTag, isOpen]);

    const handleSelect = useCallback(
      (value: number) => {
        const newValue = selected === value ? null : value;
        setSelected(newValue);
        haptics.selection();
        // Auto-select on tap (no confirm button needed)
        onSelect(newValue);
      },
      [selected, onSelect, haptics]
    );

    const handleTagSelect = useCallback(
      (tagValue: RpeTag) => {
        const next = selectedTag === tagValue ? null : tagValue;
        setSelectedTag(next);
        haptics.selection();
        onSelectTag?.(next);
      },
      [selectedTag, haptics, onSelectTag]
    );

    const currentLabel = currentValue ? RPE_LABELS[currentValue] : null;

    return (
      <Sheet isOpen={isOpen} onClose={onClose} title="RPE · דירוג מאמץ" ariaLabel="בחירת RPE">
        {/* Sub-header: current label + target badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            minHeight: 24,
          }}
        >
          {currentLabel ? (
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 18,
                color: 'var(--fs-ink)',
              }}
            >
              {currentLabel}
            </div>
          ) : (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--fs-muted)',
                letterSpacing: '0.06em',
              }}
            >
              בחר ערך
            </span>
          )}
          {targetRPE && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--fs-accent)',
                fontWeight: 700,
                letterSpacing: '0.08em',
                padding: '4px 10px',
                background: 'var(--fs-surface-2)',
                borderRadius: 'var(--radius-asymmetric)',
              }}
            >
              יעד: RPE {targetRPE}
            </span>
          )}
        </div>

        {/* RPE Numbers */}
        <div
          role="radiogroup"
          aria-label="ערך RPE"
          tabIndex={-1}
          onKeyDown={(e) => {
            const idx = RPE_VALUES.indexOf(selected ?? RPE_VALUES[0]!);
            // RTL layout: ArrowLeft = visually forward = higher RPE value
            //             ArrowRight = visually backward = lower RPE value
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
              e.preventDefault();
              const next = RPE_VALUES[Math.min(idx + 1, RPE_VALUES.length - 1)]!;
              handleSelect(next);
            } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
              e.preventDefault();
              const prev = RPE_VALUES[Math.max(idx - 1, 0)]!;
              handleSelect(prev);
            }
          }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 8,
            marginBottom: 16,
          }}
        >
          {RPE_VALUES.map((rpe) => {
            const isActive = selected === rpe;
            return (
              <m.button
                key={rpe}
                type="button"
                whileTap={{ scale: 0.93 }}
                onClick={() => handleSelect(rpe)}
                role="radio"
                aria-checked={isActive}
                tabIndex={isActive || (selected === null && rpe === RPE_VALUES[0]) ? 0 : -1}
                className={`chip magnetic-card${isActive ? ' accent-glow' : ''}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  minHeight: 48,
                  padding: '14px 4px',
                  background: isActive ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
                  border: isActive ? '1.5px solid var(--fs-accent)' : '1.5px solid transparent',
                  borderRadius: 'var(--radius-asymmetric)',
                  cursor: 'pointer',
                  transition:
                    'background-color 120ms ease, border-color 120ms ease, color 120ms ease',
                  fontFamily: 'inherit',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 900,
                    fontSize: 22,
                    lineHeight: 1,
                    color: isActive ? 'var(--color-ink-on-accent)' : 'var(--fs-ink)',
                  }}
                >
                  {rpe}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 8,
                    color: isActive ? 'rgba(255,255,255,0.85)' : 'var(--fs-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {RPE_LABELS[rpe as keyof typeof RPE_LABELS]?.slice(0, 4) ?? ''}
                </span>
              </m.button>
            );
          })}
        </div>

        {/* Tags */}
        <div>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.18em',
              color: 'var(--fs-muted)',
              textTransform: 'uppercase',
              fontWeight: 700,
              display: 'block',
              marginBottom: 8,
            }}
          >
            תיוג סט
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {RPE_TAGS.map((tag) => {
              const isActive = selectedTag === tag.value;
              return (
                <m.button
                  key={tag.value}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleTagSelect(tag.value)}
                  aria-pressed={isActive}
                  style={{
                    minHeight: 44,
                    padding: '8px 14px',
                    background: isActive ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
                    border: isActive ? '1.5px solid var(--fs-accent)' : '1.5px solid transparent',
                    borderRadius: 'var(--radius-asymmetric)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 700,
                    color: isActive ? 'var(--color-ink-on-accent)' : 'var(--fs-ink)',
                    cursor: 'pointer',
                    transition:
                      'background-color 120ms ease, border-color 120ms ease, color 120ms ease',
                  }}
                >
                  {tag.label}
                </m.button>
              );
            })}
          </div>
        </div>
      </Sheet>
    );
  }
);

RPEPicker.displayName = 'RPEPicker';

export default RPEPicker;
