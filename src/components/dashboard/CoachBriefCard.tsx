// ============================================================================
// CoachBriefCard — the broad AI surface, grounded in deterministic math
// ============================================================================
//
// Renders a CoachBrief: the HERO NUMBERS come straight from `facts` (computed in
// TypeScript, never from the model) and show instantly; the prose explanation is
// phrased asynchronously by the AI provider, falling back to a math-consistent
// template. Serves both the daily-readiness card and the weekly-review note.
// Voice follows VISION.md: factual, no emoji, numbers as the focal point.
// ============================================================================

import { memo, useEffect, useMemo, useState } from 'react';
import {
  type CoachBrief,
  type CoachBriefFacts,
  type CoachBriefKind,
  buildCoachFacts,
  generateCoachBrief,
} from '../../services/ai/coachBrief';
import { type RecoveryLog, getRecoveryLogsByDateRange } from '../../services/bodyStatsService';
import type { WorkoutSession } from '../../types';
import { logger } from '../../utils/logger';

interface CoachBriefCardProps {
  sessions: WorkoutSession[];
  kind: CoachBriefKind;
}

const REC_LABEL: Record<CoachBriefFacts['recommendation'], string> = {
  push: 'העלה עומס',
  maintain: 'שמור עומס',
  deload: 'דלואד',
  rest: 'מנוחה',
};

const REC_COLOR: Record<CoachBriefFacts['recommendation'], string> = {
  push: 'var(--fs-accent)',
  maintain: 'var(--fs-ink)',
  deload: 'var(--fs-warn, #d97706)',
  rest: 'var(--fs-warn, #d97706)',
};

const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const CoachBriefCard = memo(function CoachBriefCard({
  sessions,
  kind,
}: CoachBriefCardProps) {
  const [recoveryLogs, setRecoveryLogs] = useState<RecoveryLog[]>([]);
  const [brief, setBrief] = useState<CoachBrief | null>(null);

  // Recent recovery logs make the readiness number recovery-aware.
  useEffect(() => {
    let active = true;
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 14);
    getRecoveryLogsByDateRange(dateKey(start), dateKey(now))
      .then((logs) => {
        if (active) setRecoveryLogs(logs);
      })
      .catch((err) => logger.ai.warn('CoachBriefCard: recovery fetch failed', err));
    return () => {
      active = false;
    };
  }, []);

  // Hero numbers render instantly from deterministic math.
  const facts = useMemo(
    () => buildCoachFacts({ sessions, recoveryLogs }),
    [sessions, recoveryLogs]
  );

  // Prose is phrased asynchronously; never blocks the numbers.
  useEffect(() => {
    let active = true;
    generateCoachBrief(kind, { sessions, recoveryLogs })
      .then((result) => {
        if (active) setBrief(result);
      })
      .catch((err) => logger.ai.warn('CoachBriefCard: brief generation failed', err));
    return () => {
      active = false;
    };
  }, [kind, sessions, recoveryLogs]);

  if (sessions.length === 0) return null;

  // Sparse / first-week guard (RN coherence): with too little history the
  // readiness number is high by default, yet the underlying template can still
  // pair it with a "sharp load spike" warning and a push-load nudge after a
  // single workout — a contradiction. When confidence is low on the daily card
  // we lead with the partial-data frame instead of that prose, so the message
  // matches the thin data. The hero score itself stays (it's a computed fact).
  const isSparse = kind === 'daily-readiness' && facts.confidence === 'low';
  const detail = isSparse
    ? 'עוד מעט נתונים — אספנו מעט אימונים. המשך לתעד כדי שההמלצה היומית תהיה מדויקת.'
    : (brief?.detail ?? '');
  const sign = facts.volumeChangePercent >= 0 ? '+' : '';

  return (
    <section
      aria-label={kind === 'weekly-review' ? 'סקירה שבועית' : 'מוכנות לאימון'}
      className="magnetic-card glass-surface fs-accent-rail scrim-noise fade-rise-in"
      style={{
        margin: '16px 0',
        padding: '16px 18px',
        border: '1px solid var(--fs-surface-2)',
        borderRadius: '22px 16px 22px 16px',
        background: 'var(--fs-surface)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--fs-muted)',
          marginBottom: 8,
        }}
      >
        {kind === 'weekly-review' ? 'סקירה שבועית' : 'מוכנות היום'}
      </div>

      {kind === 'daily-readiness' ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 6 }}>
          <span
            dir="ltr"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 56,
              fontWeight: 800,
              lineHeight: 1,
              color: 'var(--fs-ink)',
            }}
          >
            {facts.readinessScore}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fs-muted)' }}>
            /100
          </span>
          <span
            style={{
              marginInlineStart: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: REC_COLOR[facts.recommendation],
            }}
          >
            {REC_LABEL[facts.recommendation]}
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
          <span
            dir="ltr"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 44,
              fontWeight: 800,
              lineHeight: 1,
              color: 'var(--fs-ink)',
            }}
          >
            {facts.weeklyVolume.toLocaleString()}
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fs-muted)' }}>
            ק"ג
          </span>
          <span
            dir="ltr"
            style={{
              marginInlineStart: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color:
                facts.volumeChangePercent >= 0 ? 'var(--fs-accent)' : 'var(--fs-warn, #d97706)',
            }}
          >
            {sign}
            {facts.volumeChangePercent}%
          </span>
        </div>
      )}

      <p
        style={{
          margin: '6px 0 0',
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          lineHeight: 1.5,
          color: 'var(--fs-ink)',
          minHeight: 19,
        }}
      >
        {detail || <span style={{ color: 'var(--fs-muted)' }}>מחשב…</span>}
      </p>

      {brief && (
        <div
          style={{
            marginTop: 10,
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--fs-muted)',
          }}
        >
          {brief.source === 'ai' ? 'AI · מבוסס נתונים' : 'חישוב מתמטי'}
          {facts.confidence !== 'high' &&
            ` · ביטחון ${facts.confidence === 'low' ? 'נמוך' : 'בינוני'}`}
        </div>
      )}
    </section>
  );
});
