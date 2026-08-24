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

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useCountUp } from '../../hooks/useCountUp';
import { DUR } from '../../lib/motionTokens';
import {
  type CoachBrief,
  type CoachBriefFacts,
  type CoachBriefKind,
  buildCoachFacts,
  deterministicProse,
  generateCoachBrief,
} from '../../services/ai/coachBrief';
import { type RecoveryLog, getRecoveryLogsByDateRange } from '../../services/bodyStatsService';
import type { WorkoutSession } from '../../types';
import { formatThousands } from '../../utils/formatThousands';
import { logger } from '../../utils/logger';
import { type Zone, zoneColor } from '../../utils/zoneColor';
import { VerdictLine } from '../insights/VerdictLine';
import { HeroStat } from '../ui/HeroStat';

interface CoachBriefCardProps {
  sessions: WorkoutSession[];
  kind: CoachBriefKind;
  /**
   * Compact mode strips the standalone card chrome (and the hero number) and
   * renders just the verdict line + source caption, so the brief can be embedded
   * as a caption beneath another surface (e.g. the weekly rings) instead of a
   * second twin card. Default false = full standalone card.
   */
  compact?: boolean;
}

const REC_LABEL: Record<CoachBriefFacts['recommendation'], string> = {
  push: 'העלו עומס',
  maintain: 'שמרו עומס',
  deload: 'דלואד',
  rest: 'מנוחה',
};

// Recommendation → grading zone (the single 3-state vocabulary). push reads as
// "on track / strong" (good), maintain is no-opinion (neutral), and deload/rest
// flag "needs attention" (attention=warn). Never --fs-signal: lime is PR-only.
const REC_ZONE: Record<CoachBriefFacts['recommendation'], Zone> = {
  push: 'good',
  maintain: 'neutral',
  deload: 'attention',
  rest: 'attention',
};

const dateKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const CoachBriefCard = memo(function CoachBriefCard({
  sessions,
  kind,
  compact = false,
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

  // Count-up cascade for the hero figure. Each ref targets only its own layout's
  // number node; the inactive layout's ref is null and useCountUp no-ops safely.
  // Reduced-motion is handled inside useCountUp (snaps to the final value).
  const readinessRef = useRef<HTMLSpanElement>(null);
  const volumeRef = useRef<HTMLSpanElement>(null);
  useCountUp(readinessRef, facts.readinessScore, { duration: DUR.count, pop: true });
  useCountUp(volumeRef, facts.weeklyVolume, {
    duration: DUR.count,
    delay: 0.1,
    format: formatThousands,
  });

  if (sessions.length === 0) return null;

  // Sparse / first-week guard (RN coherence): with too little history the
  // readiness number is high by default, yet the underlying template can still
  // pair it with a "sharp load spike" warning and a push-load nudge after a
  // single workout — a contradiction. When confidence is low on the daily card
  // we lead with the partial-data frame instead of that prose, so the message
  // matches the thin data. The hero score itself stays (it's a computed fact).
  const isSparse = kind === 'daily-readiness' && facts.confidence === 'low';
  // Synchronous math-template fallback so the verdict line never sticks on a
  // permanent "מחשב…": the AI prose only *replaces* this once it resolves. Built
  // from deterministic facts (recommendation + weekly volume change), never the
  // model. generateCoachBrief never throws, so this is the pre-resolve and the
  // failure path both.
  // Reuse the service's canonical fallback prose. It's QUALITATIVE (the volume
  // number lives in the headline, not the detail) so the verdict line explains
  // what the week/day means instead of restating the figure the rings + bento
  // row already show right above it — and the pre-resolve and AI-failure paths
  // now read identically to the deterministic source of truth.
  const factDetail = deterministicProse(kind, facts).detail;
  const detail = isSparse
    ? 'עוד מעט נתונים — אספנו מעט אימונים. המשך לתעד כדי שההמלצה היומית תהיה מדויקת.'
    : (brief?.detail ?? factDetail);
  const sign = facts.volumeChangePercent >= 0 ? '+' : '';

  // Source caption — fall back to "חישוב מתמטי" before the AI prose resolves so
  // the line is honest about its origin during loading.
  const sourceCaption = (
    <div
      style={{
        marginTop: 10,
        fontFamily: 'var(--font-mono)',
        fontSize: 9,
        letterSpacing: '-0.01em',
        color: 'var(--fs-muted)',
      }}
    >
      {brief?.source === 'ai' ? 'AI · מבוסס נתונים' : 'חישוב מתמטי'}
      {facts.confidence !== 'high' && ` · ביטחון ${facts.confidence === 'low' ? 'נמוך' : 'בינוני'}`}
    </div>
  );

  // Compact mode: just the verdict + source caption, no card chrome / hero
  // number — for embedding beneath the weekly rings instead of a twin card.
  if (compact) {
    return (
      <div style={{ marginTop: 12 }}>
        <VerdictLine kicker={kind === 'weekly-review' ? 'מה זה אומר' : 'ההמלצה'}>
          {detail}
        </VerdictLine>
        {sourceCaption}
      </div>
    );
  }

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
          letterSpacing: '-0.01em',
          color: 'var(--fs-muted)',
          marginBottom: 8,
        }}
      >
        {kind === 'weekly-review' ? 'סקירה שבועית' : 'מוכנות היום'}
      </div>

      {kind === 'daily-readiness' ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 6 }}>
          {/* HeroStat is the protagonist number; the count-up writes into the
              inner span via readinessRef. unit carries the /100 scale. */}
          <HeroStat
            value={<span ref={readinessRef}>{facts.readinessScore}</span>}
            label="מוכנות"
            unit="/100"
            size={56}
          />
          {/* Recommendation badge — color comes from the 3-state zone scale
              (push=good/maintain=neutral/deload+rest=attention), never lime. */}
          <span
            style={{
              marginInlineStart: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: zoneColor(REC_ZONE[facts.recommendation]),
            }}
          >
            {REC_LABEL[facts.recommendation]}
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 6 }}>
          <HeroStat
            value={<span ref={volumeRef}>{formatThousands(facts.weeklyVolume)}</span>}
            label="נפח שבועי"
            unit={'ק"ג'}
            size={44}
          />
          {/* Volume delta — accent when up, attention(warn) when down. */}
          <span
            dir="ltr"
            style={{
              marginInlineStart: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: zoneColor(facts.volumeChangePercent >= 0 ? 'good' : 'attention'),
            }}
          >
            {sign}
            {facts.volumeChangePercent}%
          </span>
        </div>
      )}

      {/* Takeaway as a stated verdict ("so what"), not a loose caption. The
          deterministic math-template fills it instantly; AI prose replaces it
          once it resolves — it never sticks on a permanent spinner. */}
      <VerdictLine kicker={kind === 'weekly-review' ? 'מה זה אומר' : 'ההמלצה'}>
        {detail}
      </VerdictLine>

      {sourceCaption}
    </section>
  );
});
