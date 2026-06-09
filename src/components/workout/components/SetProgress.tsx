// SetProgress — Fresh Steel segmented progress spine for the active workout.
// A thin, segmented bar that fills var(--fs-accent) as sets complete, with the
// current segment highlighted in --fs-accent-2 and a "סט X מתוך Y" label
// (numbers dir="ltr"). Replaces the old per-set dots; tokenized for both light
// (Fresh Steel) and dark (Obsidian) modes — no hardcoded colors.

import { memo } from 'react';

// ============================================================
// COMPONENT
// ============================================================

export interface SetProgressProps {
  /** Index of the active set (0-based). */
  current: number;
  /** Total planned sets. */
  total: number;
  /** Count of completed sets. */
  completed: number;
  /** Indices that are warmup sets — rendered in a muted accent tint. */
  warmupIndices?: Set<number>;
}

export const SetProgress = memo<SetProgressProps>(
  ({ current, total, completed, warmupIndices }) => {
    if (total <= 0) return null;

    // Label: completed → "הושלם", otherwise the 1-based position of the active
    // set. Clamp so a virtual index past the end still reads as the last set.
    const isComplete = completed >= total;
    const activePosition = Math.min(current + 1, total);

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
        {/* Segmented spine */}
        <div
          style={{ display: 'flex', gap: 3, flex: 1, direction: 'ltr' }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={completed}
          aria-label={`התקדמות סטים: ${completed} מתוך ${total}`}
        >
          {Array.from({ length: total }).map((_, idx) => {
            const isCompleted = idx < completed;
            const isCurrent = !isComplete && idx === current;
            const isWarmup = warmupIndices?.has(idx) ?? false;

            let background = 'var(--fs-surface-2)';
            if (isCompleted) {
              background = isWarmup
                ? 'color-mix(in srgb, var(--fs-accent) 45%, transparent)'
                : 'var(--fs-accent)';
            } else if (isCurrent) {
              background = 'var(--fs-accent-2)';
            }

            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: positional segments derived from a count, never reordered
                key={idx}
                style={{
                  flex: 1,
                  height: 4,
                  minWidth: 6,
                  borderRadius: 999,
                  background,
                  boxShadow: isCurrent
                    ? '0 0 6px color-mix(in srgb, var(--fs-accent-2) 55%, transparent)'
                    : 'none',
                  transition: 'background-color 250ms ease, box-shadow 250ms ease',
                }}
              />
            );
          })}
        </div>

        {/* "סט X מתוך Y" — numbers dir="ltr" */}
        <span
          style={{
            flexShrink: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: 'var(--fs-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          {isComplete ? (
            <>
              הושלם · <span dir="ltr">{`${total}/${total}`}</span>
            </>
          ) : (
            <>
              סט <span dir="ltr">{activePosition}</span> מתוך <span dir="ltr">{total}</span>
            </>
          )}
        </span>
      </div>
    );
  }
);

SetProgress.displayName = 'SetProgress';
