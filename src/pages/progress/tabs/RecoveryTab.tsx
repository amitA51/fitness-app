import { Activity, Battery, Dumbbell, Heart, Moon, Plus, Wind } from 'lucide-react';
import { memo, useRef } from 'react';
import { RingProgress } from '../../../components/charts/RingProgress';
import { VerdictLine, VerdictNumber } from '../../../components/insights/VerdictLine';
import { useCountUp } from '../../../hooks/useCountUp';
import { getLegacyRecoveryScore } from '../../../services/bodyStatsService';
import type { RecoveryLog } from '../../../services/bodyStatsService';
import { type Zone, zoneColor } from '../../../utils/zoneColor';
import { ChapterBreak } from '../components/ChapterBreak';
import { RecoveryBar } from '../components/RecoveryBar';
import { SectionCard } from '../components/SectionCard';
import type { WeeklyRecoveryAverage } from '../types';

// Count-up for the recovery score, synced to the SVG ring draw (1.2s ease-out).
// Style-less: inherits the surrounding number treatment; snaps under reduced motion.
function ScoreCountUp({ value, color }: { value: number; color: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useCountUp(ref, value, { duration: 1.2 });
  return (
    <div
      ref={ref}
      className="text-3xl font-black leading-none kinetic-number"
      dir="ltr"
      style={{ color }}
    >
      {value}
    </div>
  );
}

// 0–100 recovery score → zone for a plain-Hebrew, gender-safe takeaway.
const recoveryZone = (score: number): Zone =>
  score >= 70 ? 'good' : score >= 45 ? 'neutral' : 'attention';

const recoveryTakeaway = (score: number): string => {
  if (score >= 70) return ' — הגוף מוכן לאימון אינטנסיבי.';
  if (score >= 45) return ' — אפשר להתאמן, אך כדאי לשמור על עומס מתון.';
  return ' — שווה לתת לגוף עוד יום מנוחה לפני אימון כבד.';
};

export const RecoveryTab = memo(function RecoveryTab({
  todayRecovery,
  recoveryScore,
  weeklyRecovery,
  history,
  onAdd,
}: {
  todayRecovery: RecoveryLog | null;
  recoveryScore: ReturnType<typeof getLegacyRecoveryScore> | null;
  weeklyRecovery: WeeklyRecoveryAverage;
  // Recovery history is loaded once by the parent's single data source and passed
  // down — the tab no longer fetches its own logs.
  history: RecoveryLog[];
  onAdd: () => void;
}) {
  const scoreColor = recoveryScore?.color ?? 'var(--fs-muted)';
  const scorePct = recoveryScore ? recoveryScore.score : 0;

  return (
    <div className="space-y-4">
      <ChapterBreak title="התאוששות" />

      {/* Verdict line — recovery readiness leads, score tinted by its zone. */}
      {recoveryScore && (
        <VerdictLine kicker="מצב היום">
          ציון ההתאוששות שלך עומד על{' '}
          <VerdictNumber value={recoveryScore.score} zone={recoveryZone(recoveryScore.score)} />
          {recoveryTakeaway(recoveryScore.score)}
        </VerdictLine>
      )}

      {/* Recovery score */}
      <SectionCard style={{ padding: 20 }}>
        <div className="flex items-center justify-between mb-5">
          <h2
            className="section-title"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.15em',
              color: 'var(--fs-muted)',
            }}
          >
            ציון התאוששות
          </h2>
          <button
            type="button"
            onClick={onAdd}
            className="chip"
            // Action chip uses the mint accent (signal lime is reserved for
            // PR/celebration). ink-on-accent keeps AA contrast in both themes —
            // the previous lime+heading pair failed contrast in dark mode.
            style={{ background: 'var(--fs-accent)', color: 'var(--color-ink-on-accent)' }}
          >
            <Plus size={12} aria-hidden="true" />
            עדכן
          </button>
        </div>

        {recoveryScore ? (
          <div>
            <div className="flex items-center gap-6 mb-5">
              {/* Shared RingProgress primitive — inherits the premium gauge (track,
                  arc, leading tip, reduced-motion-safe dash transition) instead of
                  the former hand-rolled strokeDasharray math. The score color comes
                  from the recovery scale, the count-up lives in centerContent. */}
              <div className="flex-shrink-0">
                <RingProgress
                  value={scorePct}
                  size={112}
                  strokeWidth={6}
                  color={scoreColor}
                  ariaLabel={`ציון התאוששות: ${scorePct}%`}
                  centerContent={
                    <div className="text-center">
                      <ScoreCountUp value={recoveryScore.score} color={scoreColor} />
                      <div
                        className="text-[11px] mt-1 font-mono"
                        style={{ color: 'var(--fs-muted)' }}
                      >
                        {recoveryScore.label}
                      </div>
                    </div>
                  }
                />
              </div>

              <div className="flex-1 space-y-3">
                <RecoveryBar
                  label="שינה"
                  value={recoveryScore.sleepScore}
                  max={25}
                  color="var(--fs-accent)"
                />
                <RecoveryBar
                  label="כאב"
                  value={recoveryScore.sorenessScore}
                  max={25}
                  color="var(--fs-warn)"
                />
                <RecoveryBar
                  label="אנרגיה"
                  value={recoveryScore.energyScore}
                  max={25}
                  // Neutral accent — siblings use accent/warn/neutral and lime
                  // (--fs-signal) is reserved for PR celebration, not a metric bar.
                  color="var(--fs-accent)"
                />
                <RecoveryBar
                  label="לחץ"
                  value={recoveryScore.stressScore}
                  max={25}
                  color="var(--fs-accent)"
                />
              </div>
            </div>

            {todayRecovery?.tightAreas && todayRecovery.tightAreas.length > 0 && (
              <div className="pt-4" style={{ borderTop: '1px solid var(--fs-surface-2)' }}>
                <p className="text-[11px]" style={{ color: 'var(--fs-muted)', marginBottom: 8 }}>
                  אזורים תפוסים
                </p>
                <div className="flex flex-wrap gap-2">
                  {todayRecovery.tightAreas.map((area) => (
                    <span
                      key={area}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '9999px',
                        fontSize: 11,
                        fontWeight: 600,
                        background: 'var(--fs-surface-2)',
                        color: 'var(--fs-ink)',
                        border: '1px solid var(--fs-surface-2)',
                      }}
                    >
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 text-center gap-3">
            <Heart size={30} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />
            <p style={{ fontSize: 13, color: 'var(--fs-muted)' }}>
              עדיין לא דיווחת על ההתאוששות שלך
            </p>
            <button type="button" onClick={onAdd} className="btn-primary" style={{ minHeight: 44 }}>
              התחל דיווח
            </button>
          </div>
        )}
      </SectionCard>

      {/* Weekly avg */}
      {weeklyRecovery.avgScore > 0 && (
        <SectionCard style={{ padding: 20 }}>
          <h3
            className="section-title mb-4 flex items-center gap-2"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.15em',
              color: 'var(--fs-muted)',
            }}
          >
            <Activity size={14} />
            ממוצע שבועי
          </h3>
          {/* 2×2 strip (CSS .data-strip), value-as-anchor. Icon colors are
              semantic: sleep=accent, soreness=warn, energy/stress=neutral —
              never lime (--fs-signal is PR-celebration only). On very narrow
              screens it collapses to a single readable column. */}
          <div
            className="data-strip"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))' }}
          >
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Moon size={12} style={{ color: 'var(--fs-accent)' }} aria-hidden="true" />
                <span className="eyebrow">SLEEP</span>
              </div>
              <div className="val">
                {weeklyRecovery.avgSleep}
                <em>H</em>
              </div>
              <div className="lbl">שינה ממוצעת</div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Battery size={12} style={{ color: zoneColor('neutral') }} aria-hidden="true" />
                <span className="eyebrow">ENERGY</span>
              </div>
              <div className="val">
                {weeklyRecovery.avgEnergy}
                <em>/5</em>
              </div>
              <div className="lbl">אנרגיה ממוצעת</div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Dumbbell size={12} style={{ color: 'var(--fs-warn)' }} aria-hidden="true" />
                <span className="eyebrow">SORENESS</span>
              </div>
              <div className="val">
                {weeklyRecovery.avgSoreness}
                <em>/5</em>
              </div>
              <div className="lbl">תחושת כאב</div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Wind size={12} style={{ color: zoneColor('neutral') }} aria-hidden="true" />
                <span className="eyebrow">STRESS</span>
              </div>
              <div className="val">
                {weeklyRecovery.avgStress}
                <em>/5</em>
              </div>
              <div className="lbl">רמת לחץ</div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* History */}
      {history.length > 0 && (
        <SectionCard style={{ padding: 20 }}>
          <h3
            className="section-title mb-3"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.15em',
              color: 'var(--fs-muted)',
            }}
          >
            היסטוריית התאוששות
          </h3>
          <div className="space-y-1">
            {history
              .slice()
              .reverse()
              .slice(0, 7)
              .map((log) => {
                const score = getLegacyRecoveryScore(log);
                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-2.5"
                    style={{ borderBottom: '1px solid var(--fs-surface-2)' }}
                  >
                    <span style={{ color: 'var(--fs-muted)', fontSize: 13 }}>
                      {new Date(log.date).toLocaleDateString('he-IL', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 11, fontWeight: 500, color: score.color }}>
                        {score.label}
                      </span>
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[13px]"
                        style={{ backgroundColor: `${score.color}18`, color: score.color }}
                      >
                        {score.score}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </SectionCard>
      )}
    </div>
  );
});
