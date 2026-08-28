// SetProgress — Fresh Steel segmented progress spine for the active workout.
// A thin, segmented bar that fills var(--fs-accent) as sets complete, with the
// current segment highlighted in --fs-accent-2 and a "הבא · סט X מתוך Y" label
// (numbers dir="ltr"). Replaces the old per-set dots; tokenized for both light
// (Fresh Steel) and dark (Obsidian) modes — no hardcoded colors.
//
// The label names the set you are ABOUT TO DO, so it carries the direction word
// "הבא". Without it, "סט 3 מתוך 5" right after finishing set 2 is ambiguous —
// the reader cannot tell whether 3 is done or pending. The filled segments
// already encode how many are DONE; the text says what comes NEXT, and the
// slide-to-complete verb names the set it will finish ("החליקו לסיום סט 3").

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

    // Label: completed → "הושלם", otherwise the 1-based position of the set the
    // lifter is about to do, prefixed with "הבא" so the number's direction is
    // explicit. Clamp so a virtual index past the end still reads as the last set.
    const isComplete = completed >= total;
    const activePosition = Math.min(current + 1, total);

    // Working-set-aware label: counts working sets only, with warmups shown as a
    // distinct "חימום" phase. Falls back to the plain all-sets label when no
    // working counts are supplied.
    // `ariaText` is the plain-text twin of `label` and is what the progressbar
    // announces. It MUST count the same sets the visible label counts — reading
    // out the all-sets tally while the screen shows the working-set tally gave
    // screen-reader users a different number than everyone else. It must also
    // keep the "הבא" direction word, or the announcement is ambiguous in exactly
    // the way the visible label no longer is.
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
            הבא · חימום <span dir="ltr">{pos}</span> מתוך <span dir="ltr">{warmupTotal}</span>
          </>
        );
        ariaText = `הבא, חימום ${pos} מתוך ${warmupTotal}`;
      } else {
        const pos = Math.min((workingCompleted ?? 0) + 1, workingTotal ?? 0);
        label = (
          <>
            הבא · סט <span dir="ltr">{pos}</span> מתוך <span dir="ltr">{workingTotal}</span>
          </>
        );
        ariaText = `הבא, סט ${pos} מתוך ${workingTotal}`;
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
          הבא · סט <span dir="ltr">{activePosition}</span> מתוך <span dir="ltr">{total}</span>
        </>
      );
      ariaText = `הבא, סט ${activePosition} מתוך ${total}`;
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
        {/* Segmented spine. NO hardcoded `direction` — the spine inherits the
            document direction so segment 1 sits at the READING START and the
            fill advances the way the language is read (right→left in Hebrew).
            A forced `direction: ltr` made the bar fill away from the reading
            start, which is the mirrored-progress defect RTL platforms (iOS,
            Android, Bootstrap RTL) all avoid. */}
        {/* biome-ignore lint/a11y/useFocusableInteractive: a progressbar is a read-only status indicator (WAI-ARIA APG); a keyboard tab stop here would be non-actionable and harm focus order (WCAG 2.4.3). */}
        <div
          style={{ display: 'flex', gap: 3, flex: 1 }}
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

        {/* "הבא · סט X מתוך Y" — numbers dir="ltr" */}
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
