// ============================================================================
// LastWorkoutCard — "what did I last do", one tap from its full detail.
// ============================================================================
// The home screen knew the trainee's last session all along and never showed it.
// This is the recap: what it was, when, how long, how much volume, and a PR
// mention only when the already-aggregated records prove one — no extra lookup
// is performed for it.
//
// The whole card is the link to `/detail/:id` (44px+ target, one obvious tap).
// Chevron points toward the reading direction (left in RTL = forward), matching
// the other dashboard rows. Lime --fs-signal appears ONLY on the PR chip, paired
// with its documented ink token so it reads in both themes.

import { ChevronLeft } from 'lucide-react';
import { memo } from 'react';
import { Link } from 'react-router-dom';
import { UNIT_KM, formatKm } from '../../utils/cardio';
import { formatThousandsDecimal } from '../../utils/formatThousands';
import { formatDuration } from '../../utils/workoutFormatters';
import type { LastWorkoutRecap } from './homeStats';

interface LastWorkoutCardProps {
  recap: LastWorkoutRecap;
}

const statStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: '-0.01em',
  color: 'var(--fs-muted)',
};

export const LastWorkoutCard = memo(function LastWorkoutCard({ recap }: LastWorkoutCardProps) {
  const prLabel =
    recap.prCount === 1 ? 'שיא חדש' : recap.prCount > 1 ? `${recap.prCount} שיאים חדשים` : null;

  return (
    <Link
      to={`/detail/${recap.id}`}
      className="fs-surface-card focus-ring active:scale-[0.99]"
      aria-label={`האימון האחרון: ${recap.name}, ${recap.dateLabel}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px 18px',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <span style={{ minWidth: 0, flex: 1, display: 'grid', gap: 4 }}>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '-0.01em',
            color: 'var(--fs-muted)',
          }}
        >
          האימון האחרון
        </span>

        <span
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            flexWrap: 'wrap',
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 17,
              lineHeight: 1.2,
              letterSpacing: '-0.015em',
              color: 'var(--fs-ink)',
              overflowWrap: 'anywhere',
            }}
          >
            <bdi>{recap.name}</bdi>
          </span>
          <span style={statStyle}>{recap.dateLabel}</span>
        </span>

        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginBlockStart: 2,
          }}
        >
          {recap.durationSec > 0 && (
            <span style={statStyle}>{formatDuration(recap.durationSec)}</span>
          )}
          {recap.durationSec > 0 && recap.volume > 0 && (
            <span aria-hidden="true" style={statStyle}>
              ·
            </span>
          )}
          {recap.volume > 0 && (
            <span style={statStyle}>
              <span dir="ltr" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {formatThousandsDecimal(recap.volume)}
              </span>{' '}
              ק״ג
            </span>
          )}
          {recap.distanceKm > 0 && (
            <span style={statStyle}>
              {(recap.durationSec > 0 || recap.volume > 0) && (
                <span aria-hidden="true" style={{ marginInlineEnd: 8 }}>
                  ·
                </span>
              )}
              <span dir="ltr" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                {formatKm(recap.distanceKm)}
              </span>{' '}
              {UNIT_KM}
            </span>
          )}
          {prLabel && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--fs-signal)',
                color: 'var(--color-on-mustard)',
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '-0.01em',
              }}
            >
              {prLabel}
            </span>
          )}
        </span>
      </span>

      <ChevronLeft
        size={20}
        aria-hidden="true"
        style={{ color: 'var(--fs-muted)', flexShrink: 0 }}
      />
    </Link>
  );
});

export default LastWorkoutCard;
