import { Flame, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { memo, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConsistencyScore } from '../../../components/insights/ConsistencyScore';
import { MuscleBalanceInsight } from '../../../components/insights/MuscleBalanceInsight';
import { MuscleDistribution } from '../../../components/insights/MuscleDistribution';
import { VerdictLine, VerdictNumber } from '../../../components/insights/VerdictLine';
import { HeroStat } from '../../../components/ui/HeroStat';
import { useCountUp } from '../../../hooks/useCountUp';
import { useWorkoutStreak } from '../../../hooks/useWorkoutStreak';
import type { PersonalRecord, WorkoutSession } from '../../../types';
import { formatVolume } from '../../../utils/dateUtils';
import { zoneColor } from '../../../utils/zoneColor';
import { SectionCard } from '../components/SectionCard';
import {
  type StatDelta,
  buildPRBoard,
  isRecentPR,
  recentPRs,
  summarizeWeeklyVolume,
  weekVerdict,
  weeklyCountDelta,
  weeklyVolumeDelta,
} from '../progressMetrics';

// First-reveal count-up tween whose tweened text is written to its own node.
// Style-less so it inherits the surrounding HeroStat number treatment; the hook
// snaps to the final value under prefers-reduced-motion. Used as a HeroStat value.
function CountUpValue({
  value,
  delay = 0,
  format,
}: {
  value: number;
  delay?: number;
  format?: (v: number) => string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useCountUp(ref, value, { delay, ...(format ? { format } : {}) });
  return (
    <span ref={ref} dir="ltr">
      {format ? format(value) : value}
    </span>
  );
}

// Mono "vs last week" delta chip. Color comes from the zone vocabulary
// (up=good/accent, down=attention/warn, flat=neutral/muted) — never lime.
// The chip owns the sign; `format` receives the absolute magnitude.
function DeltaChip({ delta, format }: { delta: StatDelta; format: (v: number) => string }) {
  if (!delta.hasPrev) return null;
  const color = zoneColor(delta.zone);
  const up = delta.diff > 0;
  const flat = delta.diff === 0;
  const sign = flat ? '' : up ? '+' : '−';
  return (
    <span
      className="mt-1 inline-flex items-center gap-1"
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.04em',
        color,
      }}
    >
      {!flat &&
        (up ? (
          <TrendingUp size={11} aria-hidden="true" />
        ) : (
          <TrendingDown size={11} aria-hidden="true" />
        ))}
      <span dir="ltr">
        {sign}
        {format(Math.abs(delta.diff))}
      </span>
    </span>
  );
}

export const OverviewTab = memo(function OverviewTab({
  sessions,
  prs,
}: {
  sessions: WorkoutSession[];
  prs: PersonalRecord[];
}) {
  const navigate = useNavigate();
  const weekly = useMemo(() => summarizeWeeklyVolume(sessions), [sessions]);

  // Unified streak math — same hook the Dashboard chip uses, so the two surfaces
  // can never drift apart. Replaces the local computeStreak wiring.
  const streak = useWorkoutStreak(sessions);

  const board = useMemo(() => buildPRBoard(prs), [prs]);
  const latestPRs = useMemo(() => recentPRs(prs, 2), [prs]);

  const verdict = useMemo(() => weekVerdict(weekly, streak.current), [weekly, streak.current]);
  const countDelta = useMemo(() => weeklyCountDelta(weekly), [weekly]);
  const volumeDelta = useMemo(() => weeklyVolumeDelta(weekly), [weekly]);

  if (sessions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="chapter-break" style={{ marginInline: 'calc(-1 * var(--space-5))' }}>
          <span className="left" />
          <span
            className="right"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 16,
              color: 'var(--color-ink-on-dark)',
            }}
          >
            סקירה
          </span>
        </div>
        <SectionCard rail={false}>
          <div className="flex flex-col items-center py-10 text-center gap-3">
            <Trophy size={32} style={{ color: 'var(--fs-muted)' }} />
            <p style={{ fontSize: 14, color: 'var(--fs-muted)' }}>
              השלם אימון ראשון כדי לראות את הסקירה שלך
            </p>
            {/* Same recovery-path the recovery tab's empty state offers. */}
            <button
              type="button"
              onClick={() => navigate('/workout')}
              className="btn-primary"
              style={{ minHeight: 44 }}
            >
              התחל אימון
            </button>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chapter break */}
      <div className="chapter-break" style={{ marginInline: 'calc(-1 * var(--space-5))' }}>
        <span className="left" />
        <span
          className="right"
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 16,
            color: 'var(--color-ink-on-dark)',
          }}
        >
          סקירה
        </span>
      </div>

      {/* Verdict line — the week's takeaway leads, with the driving number tinted. */}
      <VerdictLine kicker="סיכום השבוע">
        {verdict.lead}
        <VerdictNumber value={verdict.count} zone={verdict.zone} />
        {verdict.tail}
      </VerdictLine>

      {/* Weekly-review card: verdict headline + 3-up hero stats with WoW deltas. */}
      <SectionCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Flame size={16} style={{ color: zoneColor(verdict.zone) }} aria-hidden="true" />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.15em',
              color: 'var(--fs-muted)',
              textTransform: 'uppercase',
            }}
          >
            השבוע האחרון
          </span>
        </div>

        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 20,
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
            color: 'var(--fs-ink)',
            margin: '0 0 14px',
          }}
        >
          {verdict.headline}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <HeroStat value={<CountUpValue value={weekly.count} />} label="אימונים" size={30} />
            <DeltaChip delta={countDelta} format={String} />
          </div>
          <div style={{ minWidth: 0 }}>
            <HeroStat
              value={<CountUpValue value={weekly.volume} delay={0.06} format={formatVolume} />}
              label='נפח (ק"ג)'
              size={30}
            />
            <DeltaChip delta={volumeDelta} format={formatVolume} />
          </div>
          <div style={{ minWidth: 0 }}>
            <HeroStat
              value={<CountUpValue value={streak.current} delay={0.12} />}
              label="רצף ימים"
              size={30}
            />
          </div>
        </div>
      </SectionCard>

      {/* Recent PRs — pulled from the same prService source as the Strength board */}
      {latestPRs.length > 0 && (
        <SectionCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Trophy size={14} style={{ color: 'var(--fs-accent)' }} />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.15em',
                color: 'var(--fs-muted)',
                textTransform: 'uppercase',
              }}
            >
              שיאים אחרונים
            </span>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {latestPRs.map((pr) => {
              const boardEntry = board.find((b) => b.exerciseName === pr.exerciseName);
              const fresh = isRecentPR(pr);
              return (
                <div
                  key={pr.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: '10px 12px',
                    background: 'var(--fs-surface-2)',
                    borderRadius: 10,
                    // Trailing-edge accent: in RTL the visual trailing edge is the
                    // inline-end (left). Anchors the row without a full rail.
                    borderInlineEnd: '2px solid var(--fs-accent)',
                  }}
                >
                  {/* Exercise name demoted: small, medium weight, muted. */}
                  <span
                    style={{
                      fontFamily: 'var(--font-hebrew)',
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--fs-muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                    }}
                  >
                    {pr.exerciseName.split('|')[0]?.trim() || pr.exerciseName}
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 5,
                      flexShrink: 0,
                    }}
                  >
                    {/* Lime dot ONLY when the PR was earned recently (celebration). */}
                    {fresh && (
                      <span
                        aria-label="שיא חדש"
                        style={{
                          alignSelf: 'center',
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: 'var(--fs-signal)',
                          marginInlineEnd: 2,
                        }}
                      />
                    )}
                    {/* Weight is the anchor — hero-like display number, LTR. */}
                    <span
                      className="kinetic-number"
                      dir="ltr"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 900,
                        fontSize: 22,
                        lineHeight: 1,
                        letterSpacing: '-0.02em',
                        color: 'var(--fs-ink)',
                      }}
                    >
                      {pr.weight}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        fontWeight: 700,
                        color: 'var(--fs-muted)',
                        letterSpacing: '0.08em',
                      }}
                    >
                      ק"ג × {pr.reps}
                    </span>
                    {boardEntry && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          fontWeight: 700,
                          color: 'var(--fs-accent)',
                          letterSpacing: '0.04em',
                          marginInlineStart: 4,
                        }}
                      >
                        1RM ~{boardEntry.e1RM}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* Consistency + muscle distribution — migrated from the Dashboard. These
          insights belong to Progress now; each self-hides when there is no data. */}
      <ConsistencyScore sessions={sessions} />
      <MuscleDistribution sessions={sessions} />
      <MuscleBalanceInsight sessions={sessions} />
    </div>
  );
});
