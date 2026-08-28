// SetProgress — Fresh Steel segmented progress spine for the active workout.
// A thin, segmented bar that fills var(--fs-accent) as sets complete, with the
// current segment highlighted in --fs-accent-2 and a "סט X מתוך Y" label
// (numbers dir="ltr"). Replaces the old per-set dots; tokenized for both light
// (Fresh Steel) and dark (Obsidian) modes — no hardcoded colors.

import { type ReactNode, memo } from 'react';

// ============================================================
// COMPONENT
// ============================================================

export interface SetProgressProps {
  /** Index of the active set (0-based). */
  current: number;
  /** Total planned sets (warmup + working) — sizes the spine. */
  total: number;
  /** Count of completed sets (warmup + working) — fills the spine. */
  completed: number;
  /** Indices that are warmup sets — rendered in a muted accent tint. */
  warmupIndices?: Set<number>;
  // Working-set-aware label data. When supplied, the "סט X מתוך Y" label counts
  // WORKING sets only (warmups are shown as a separate "חימום" phase) so warmups
  // never distort the working tally. Omitting these falls back to the plain
  // all-sets label (regular, non-program templates).
  /** Number of working (non-warmup) sets. */
  workingTotal?: number;
  /** Completed working (non-warmup) sets. */
  workingCompleted?: number;
  /** Total warmup sets. */
  warmupTotal?: number;
  /** Completed warmup sets. */
  warmupCompleted?: number;
  /** Whether the currently active set is a warmup. */
  activeIsWarmup?: boolean;
}

export const SetProgress = memo<SetProgressProps>(
  ({
    current,
    total,
    completed,
    warmupIndices,
    workingTotal,
    workingCompleted,
    warmupTotal,
    warmupCompleted,
    activeIsWarmup,
  }) => {
    if (total <= 0) return null;

    // Label: completed → "הושלם", otherwise the 1-based position of the active
    // set. Clamp so a virtual index past the end still reads as the last set.
    const isComplete = completed >= total;
    const activePosition = Math.min(current + 1, total);

    // Working-set-aware label: counts working sets only, with warmups shown as a
    // distinct "חימום" phase. Falls back to the plain all-sets label when no
    // working counts are supplied.
    // `ariaText` is the plain-text twin of `label` and is what the progressbar
    // announces. It MUST count the same sets the visible label counts — reading
    // out the all-sets tally while the screen shows the working-set tally gave
    // screen-reader users a different number than everyone else.
    const hasWorking = typeof workingTotal === 'number';
    let label: ReactNode;
    let ariaText: string;
    if (hasWorking) {
      if (isComplete) {
        label = (
          <>
            הושלם · <span dir="ltr">{`${workingTotal}/${workingTotal}`}</span>
          </>
        );
        ariaText = `הושלם, ${workingTotal} מתוך ${workingTotal}`;
      } else if (activeIsWarmup) {
        const pos = Math.min((warmupCompleted ?? 0) + 1, warmupTotal ?? 0);
        label = (
          <>
            חימום · <span dir="ltr">{pos}</span> מתוך <span dir="ltr">{warmupTotal}</span>
          </>
        );
        ariaText = `חימום ${pos} מתוך ${warmupTotal}`;
      } else {
        const pos = Math.min((workingCompleted ?? 0) + 1, workingTotal ?? 0);
        label = (
          <>
            סט <span dir="ltr">{pos}</span> מתוך <span dir="ltr">{workingTotal}</span>
          </>
        );
        ariaText = `סט ${pos} מתוך ${workingTotal}`;
      }
    } else if (isComplete) {
      label = (
        <>
          הושלם · <span dir="ltr">{`${total}/${total}`}</span>
        </>
      );
      ariaText = `הושלם, ${total} מתוך ${total}`;
    } else {
      label = (
        <>
          סט <span dir="ltr">{activePosition}</span> מתוך <span dir="ltr">{total}</span>
        </>
      );
      ariaText = `סט ${activePosition} מתוך ${total}`;
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
        {/* Segmented spine */}
        {/* biome-ignore lint/a11y/useFocusableInteractive: a progressbar is a read-only status indicator (WAI-ARIA APG); a keyboard tab stop here would be non-actionable and harm focus order (WCAG 2.4.3). */}
        <div
          style={{ display: 'flex', gap: 3, flex: 1, direction: 'ltr' }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={completed}
          aria-label={`התקדמות סטים, ${ariaText}`}
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
            letterSpacing: '-0.01em',
            color: 'var(--fs-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      </div>
    );
  }
);

SetProgress.displayName = 'SetProgress';
