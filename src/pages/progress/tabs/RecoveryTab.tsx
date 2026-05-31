import { motion } from 'framer-motion';
import { Activity, Battery, Heart, Moon, Plus } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import {
  getLegacyRecoveryScore,
  getRecoveryLogsByDateRange,
} from '../../../services/bodyStatsService';
import type { RecoveryLog } from '../../../services/bodyStatsService';
import { RecoveryBar } from '../components/RecoveryBar';
import type { WeeklyRecoveryAverage } from '../types';

export const RecoveryTab = memo(function RecoveryTab({
  todayRecovery,
  recoveryScore,
  weeklyRecovery,
  onAdd,
}: {
  todayRecovery: RecoveryLog | null;
  recoveryScore: ReturnType<typeof getLegacyRecoveryScore> | null;
  weeklyRecovery: WeeklyRecoveryAverage;
  onAdd: () => void;
}) {
  const [history, setHistory] = useState<RecoveryLog[]>([]);
  useEffect(() => {
    const load = async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const today = todayRecovery?.date ?? new Date().toISOString().slice(0, 10);
      const logs = await getRecoveryLogsByDateRange(weekAgo, today);
      setHistory(logs);
    };
    load();
  }, [todayRecovery]);

  const scoreColor = recoveryScore?.color ?? 'var(--fs-muted)';
  const scorePct = recoveryScore ? recoveryScore.score : 0;

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
            color: 'var(--fs-ink)',
          }}
        >
          ריקאברי
        </span>
      </div>

      {/* Recovery score */}
      <div
        style={{
          background: 'var(--fs-surface)',
          borderRadius: '22px 16px 22px 16px',
          border: '1px solid var(--fs-surface-2)',
          boxShadow: 'var(--shadow-card)',
          padding: '20px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            background: 'var(--fs-accent)',
            borderTopLeftRadius: '22px',
            borderBottomLeftRadius: '16px',
          }}
        />
        <div className="flex items-center justify-between mb-5">
          <h2
            className="section-title"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.15em',
              color: 'var(--fs-muted)',
              textTransform: 'uppercase',
            }}
          >
            ציון ריקאברי
          </h2>
          <button
            type="button"
            onClick={onAdd}
            className="chip"
            style={{ background: 'var(--fs-signal)', color: 'var(--fs-heading)' }}
          >
            <Plus size={12} />
            עדכן
          </button>
        </div>

        {recoveryScore ? (
          <div>
            <div className="flex items-center gap-6 mb-5">
              {/* CSS circle score */}
              <div className="relative w-28 h-28 flex-shrink-0 flex items-center justify-center">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{ background: 'var(--fs-surface-2)' }}
                />
                <div
                  className="absolute inset-2 rounded-full"
                  style={{ backgroundColor: `${scoreColor}18` }}
                />
                <div className="relative z-10 text-center">
                  <div className="text-3xl font-black leading-none" style={{ color: scoreColor }}>
                    {recoveryScore.score}
                  </div>
                  <div className="text-[11px] mt-1 font-mono" style={{ color: 'var(--fs-muted)' }}>
                    {recoveryScore.label}
                  </div>
                </div>
                <svg
                  className="absolute inset-0 w-full h-full -rotate-90"
                  viewBox="0 0 112 112"
                  aria-label={`ציון ריקאברי: ${scorePct}%`}
                  role="img"
                >
                  <circle
                    cx="56"
                    cy="56"
                    r="50"
                    fill="none"
                    stroke="var(--fs-surface-2)"
                    strokeWidth="6"
                  />
                  <motion.circle
                    cx="56"
                    cy="56"
                    r="50"
                    fill="none"
                    stroke={scoreColor}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${scorePct * 3.14} ${314 - scorePct * 3.14}`}
                    initial={{ strokeDasharray: `0 ${2 * Math.PI * 50}` }}
                    animate={{ strokeDasharray: `${scorePct * 3.14} ${314 - scorePct * 3.14}` }}
                    transition={{ duration: 1.2, ease: 'easeOut' }}
                  />
                </svg>
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
                  color="var(--fs-signal)"
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
            <Heart size={30} style={{ color: 'var(--fs-muted)' }} />
            <p style={{ fontSize: 13, color: 'var(--fs-muted)' }}>
              עדיין לא דיווחת על ההתאוששות שלך
            </p>
            <button type="button" onClick={onAdd} className="btn-primary">
              התחל דיווח
            </button>
          </div>
        )}
      </div>

      {/* Weekly avg */}
      {weeklyRecovery.avgScore > 0 && (
        <div
          style={{
            background: 'var(--fs-surface)',
            borderRadius: '22px 16px 22px 16px',
            border: '1px solid var(--fs-surface-2)',
            boxShadow: 'var(--shadow-card)',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              background: 'var(--fs-accent)',
              borderTopLeftRadius: '22px',
              borderBottomLeftRadius: '16px',
            }}
          />
          <h3
            className="section-title mb-4 flex items-center gap-2"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.15em',
              color: 'var(--fs-muted)',
              textTransform: 'uppercase',
            }}
          >
            <Activity size={14} />
            ממוצע שבועי
          </h3>
          <div className="data-strip">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Moon size={12} style={{ color: 'var(--fs-heading)' }} />
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
                <Battery size={12} style={{ color: 'var(--fs-heading)' }} />
                <span className="eyebrow">ENERGY</span>
              </div>
              <div className="val">
                {weeklyRecovery.avgEnergy}
                <em>/10</em>
              </div>
              <div className="lbl">אנרגיה ממוצעת</div>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div
          style={{
            background: 'var(--fs-surface)',
            borderRadius: '22px 16px 22px 16px',
            border: '1px solid var(--fs-surface-2)',
            boxShadow: 'var(--shadow-card)',
            padding: '20px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 4,
              background: 'var(--fs-accent)',
              borderTopLeftRadius: '22px',
              borderBottomLeftRadius: '16px',
            }}
          />
          <h3
            className="section-title mb-3"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.15em',
              color: 'var(--fs-muted)',
              textTransform: 'uppercase',
            }}
          >
            היסטוריית ריקאברי
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
        </div>
      )}
    </div>
  );
});
