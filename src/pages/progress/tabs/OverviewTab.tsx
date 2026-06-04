import { Flame, TrendingDown, TrendingUp, Trophy } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ConsistencyScore } from '../../../components/insights/ConsistencyScore';
import { MuscleDistribution } from '../../../components/insights/MuscleDistribution';
import { useWorkoutStreak } from '../../../hooks/useWorkoutStreak';
import type { PersonalRecord, WorkoutSession } from '../../../types';
import { formatVolume } from '../../../utils/dateUtils';
import { buildPRBoard, recentPRs, summarizeWeeklyVolume } from '../progressMetrics';

const cardStyle: React.CSSProperties = {
  background: 'var(--fs-surface)',
  borderRadius: '22px 16px 22px 16px',
  border: '1px solid var(--fs-surface-2)',
  boxShadow: 'var(--shadow-card)',
  padding: '16px',
  position: 'relative',
  overflow: 'hidden',
};

const railStyle: React.CSSProperties = {
  position: 'absolute',
  // Logical inline-start so the accent rail sits on the correct (right) edge in
  // the RTL layout — was physically pinned to the left, mirroring SectionCard.
  insetInlineStart: 0,
  top: 0,
  bottom: 0,
  width: 4,
  background: 'var(--fs-accent)',
  borderStartStartRadius: '22px',
  borderEndStartRadius: '16px',
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 8,
  letterSpacing: '0.12em',
  color: 'var(--fs-muted)',
  marginTop: 4,
  textTransform: 'uppercase',
};

const valueStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontWeight: 800,
  fontSize: 24,
  color: 'var(--fs-ink)',
  lineHeight: 1,
  fontVariantNumeric: 'tabular-nums',
};

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
        <div style={cardStyle}>
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
        </div>
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

      {/* Streak + weekly volume hero */}
      <div style={cardStyle}>
        <div aria-hidden="true" style={railStyle} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Flame size={16} style={{ color: 'var(--fs-accent)' }} />
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div>
            <div style={valueStyle}>{streak.current}</div>
            <div style={labelStyle}>רצף ימים</div>
          </div>
          <div>
            <div style={valueStyle}>{weekly.count}</div>
            <div style={labelStyle}>אימונים</div>
          </div>
          <div>
            <div style={valueStyle}>{formatVolume(weekly.volume)}</div>
            <div style={labelStyle}>נפח (ק"ג)</div>
          </div>
        </div>

        {/* Week-over-week volume delta */}
        {weekly.changePct !== null && (
          <div
            className="mt-4 inline-flex items-center gap-1.5"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              background: weekly.changePct >= 0 ? 'var(--fs-signal)' : 'var(--fs-primary)',
              color: weekly.changePct >= 0 ? 'var(--fs-primary)' : 'var(--fs-signal)',
              padding: '4px 10px',
              borderRadius: 8,
            }}
          >
            {weekly.changePct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {weekly.changePct > 0 ? '+' : ''}
            {weekly.changePct}% מול שבוע קודם
          </div>
        )}
      </div>

      {/* Recent PRs — pulled from the same prService source as the Strength board */}
      {latestPRs.length > 0 && (
        <div style={cardStyle}>
          <div aria-hidden="true" style={railStyle} />
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
              return (
                <div
                  key={pr.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'var(--fs-surface-2)',
                    borderRadius: 10,
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-hebrew)',
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'var(--fs-ink)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {pr.exerciseName.split('|')[0]?.trim() || pr.exerciseName}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexShrink: 0 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 800,
                        fontSize: 16,
                        color: 'var(--fs-ink)',
                        direction: 'ltr',
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
        </div>
      )}

      {/* Consistency + muscle distribution — migrated from the Dashboard. These
          insights belong to Progress now; each self-hides when there is no data. */}
      <ConsistencyScore sessions={sessions} />
      <MuscleDistribution sessions={sessions} />
    </div>
  );
});
