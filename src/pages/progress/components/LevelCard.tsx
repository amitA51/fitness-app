// LevelCard — the always-visible home of the XP level ladder.
//
// Research basis (You.com, Aug 2026): Apple's rings work because they are
// ALWAYS on screen — "simple enough to read at a glance, specific enough to
// feel earned once they close." The app already awards session XP with a
// legible formula (volume + sets + PRs) and a front-loaded level curve, but
// both lived only inside WorkoutSummary: between workouts there was zero
// visible progression. This card makes the ladder ambient — one compact strip
// on Progress/Overview showing level, XP-to-next, and progress bar.
//
// Zero-XP state (no workout finished yet) renders nothing — the empty-state
// path above it already explains what appears after the first session.

import { Zap } from 'lucide-react';
import { memo } from 'react';
import { levelFromXp } from '../../../utils/workoutLevels';
import { getTotalXp } from '../../../utils/xpStore';

export const LevelCard = memo(function LevelCard() {
  const xpTotal = getTotalXp();
  if (xpTotal <= 0) return null;

  const { level, intoLevel, levelSpan } = levelFromXp(xpTotal);
  const pct = Math.min(100, Math.max(0, Math.round((intoLevel / levelSpan) * 100)));

  return (
    <div
      role="status"
      aria-label={`רמה ${level} · עוד ${levelSpan - intoLevel} XP לרמה ${level + 1}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        background: 'color-mix(in srgb, var(--fs-accent) 8%, var(--fs-surface))',
        border: '1px solid color-mix(in srgb, var(--fs-accent) 22%, transparent)',
        borderRadius: 'var(--radius-card)',
      }}
    >
      {/* Level chip — same accent-pill language as the summary's level badge */}
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--color-ink-on-accent)',
          background: 'var(--fs-accent)',
          borderRadius: 999,
          padding: '3px 10px',
          whiteSpace: 'nowrap',
        }}
      >
        רמה {level}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 8,
            marginBottom: 5,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--fs-ink)',
              letterSpacing: '-0.01em',
            }}
          >
            <Zap
              size={13}
              strokeWidth={2.5}
              style={{ color: 'var(--fs-accent)' }}
              aria-hidden="true"
            />
            התקדמות ברמה
          </span>
          <span
            dir="ltr"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--fs-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {intoLevel} / {levelSpan} XP
          </span>
        </div>
        {/* Thin accent progress bar — same geometry as the summary's bar */}
        <div
          aria-hidden="true"
          style={{
            height: 6,
            borderRadius: 999,
            background: 'var(--fs-surface-2)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              borderRadius: 999,
              background: 'var(--fs-accent)',
            }}
          />
        </div>
      </div>
    </div>
  );
});
