// ============================================================================
// ExerciseProgressRow — one scannable row in the strength master list.
// ============================================================================
// Two lines, thumb-sized, tap-to-drill. Line 1: exercise + current e1RM (the
// hero number, LTR). Line 2: status pill + last-trained + signed delta +
// sparkline. The whole row is a button; a leading chevron (points inline-end =
// "forward" in RTL) signals it opens a detail view. No side-stripe accents
// (banned) — status lives in a tinted pill, not a rail.

import { ChevronLeft, TrendingDown, TrendingUp } from 'lucide-react';
import { memo } from 'react';
import { zoneColor } from '../../../utils/zoneColor';
import { STRENGTH_STATUS_LABEL, STRENGTH_STATUS_ZONE } from '../progressMetrics';
import { exerciseLabel, formatDaysAgo } from '../strengthFormat';
import type { ExerciseProgress } from '../types';
import { Sparkline } from './Sparkline';

export const ExerciseProgressRow = memo(function ExerciseProgressRow({
  progress,
  onOpen,
}: {
  progress: ExerciseProgress;
  onOpen: () => void;
}) {
  const { exerciseName, currentE1RM, deltaE1RM, status, daysSinceLast, points } = progress;
  const statusColor = zoneColor(STRENGTH_STATUS_ZONE[status]);
  const label = exerciseLabel(exerciseName);
  const showDelta = (status === 'improving' || status === 'declining') && deltaE1RM !== 0;
  const up = deltaE1RM > 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${label}. אחד חזרה מרבי משוער ${currentE1RM} קילוגרם. ${STRENGTH_STATUS_LABEL[status]}. פתיחת פירוט`}
      className="active:scale-[0.99] motion-reduce:active:scale-100"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        textAlign: 'start',
        background: 'var(--fs-surface-2)',
        border: 'none',
        borderRadius: 'var(--radius-lg)',
        padding: '12px 14px',
        cursor: 'pointer',
        minHeight: 44,
        transition: 'transform 0.1s var(--ease-out, ease-out)',
      }}
    >
      <span style={{ flex: 1, minWidth: 0, display: 'block' }}>
        {/* Line 1 — exercise + current e1RM */}
        <span
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <span
            className="line-clamp-1"
            style={{
              fontFamily: 'var(--font-hebrew)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--fs-ink)',
              minWidth: 0,
            }}
          >
            {label}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 3, flexShrink: 0 }}>
            <span
              className="kinetic-number"
              dir="ltr"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 22,
                lineHeight: 1,
                color: 'var(--fs-ink)',
              }}
            >
              {currentE1RM}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                fontWeight: 700,
                color: 'var(--fs-muted)',
              }}
            >
              1RM
            </span>
          </span>
        </span>

        {/* Line 2 — status + recency + delta + sparkline */}
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginTop: 6,
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: 11,
                fontWeight: 600,
                color: statusColor,
                background: `color-mix(in srgb, ${statusColor} 14%, var(--fs-surface))`,
                padding: '2px 8px',
                borderRadius: 999,
                whiteSpace: 'nowrap',
              }}
            >
              {STRENGTH_STATUS_LABEL[status]}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--fs-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {formatDaysAgo(daysSinceLast)}
            </span>
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {showDelta && (
              <span
                dir="ltr"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 2,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 700,
                  color: statusColor,
                }}
              >
                {up ? (
                  <TrendingUp size={11} aria-hidden="true" />
                ) : (
                  <TrendingDown size={11} aria-hidden="true" />
                )}
                {up ? '+' : '−'}
                {Math.abs(deltaE1RM)}
              </span>
            )}
            <Sparkline values={points.map((p) => p.e1RM)} color={statusColor} />
          </span>
        </span>
      </span>

      <ChevronLeft
        size={18}
        aria-hidden="true"
        style={{ color: 'var(--fs-muted)', flexShrink: 0 }}
      />
    </button>
  );
});

export default ExerciseProgressRow;
