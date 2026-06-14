// ============================================================================
// CLIENT 360 — Overview tab (סקירה)
// ============================================================================
// At-a-glance state: 4 stat cards, the 7-day adherence grid, an adherence-streak
// strip, and the "pause trainee" management action (active links only).

import { MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { showToast } from '../../../../components/ui/GlobalToast';
import {
  type ClientAnalytics,
  type DayAdherence,
  clientStatusMeta,
  getClientWeekAdherence,
  setClientStatus,
} from '../../../../services/coach';
import type { BodyWeightEntry } from '../../../../types';
import type { CoachClient } from '../../../../types/coach';
import { HE_NOUNS, pluralizeHe } from '../../../../utils/pluralizeHe';
import { InlineEmpty, Section, SectionError, useAsyncData } from '../../_shared';
import { OverviewStat } from '../../rosterPrimitives';
import { WeekGrid } from '../WeekGrid';
import { computeStreaks } from '../clientTrends';
import { Stat } from '../widgets';

interface OverviewTabProps {
  clientId: string;
  link: CoachClient | null;
  analytics: ClientAnalytics | null;
  latestWeight: number | undefined;
  /** Body-weight entries (newest-first) — already loaded by the orchestrator. */
  weights: BodyWeightEntry[];
  /** Open the 1:1 thread with this client (the header's message action). */
  onMessage: () => void;
  /** Called after a successful status change so the orchestrator can navigate away. */
  onPaused: () => void;
}

// ── Verdict ──────────────────────────────────────────────────────────────────────
// Turns the already-loaded analytics into ONE Hebrew sentence + the most
// relevant action, so the coach reads "what's going on + what to do" before the
// stat grid. Pure + unit-testable (no I/O, no clock beyond injected inputs).

/** Days a weight delta must exceed to be called out (avoids noise from a scale wobble). */
const WEIGHT_TREND_MIN_DELTA = 1;

export type VerdictAction = 'message' | 'none';

export interface ClientVerdict {
  /** One-line Hebrew summary of the client's current state. */
  sentence: string;
  /** The single most relevant action to surface beside the sentence. */
  action: VerdictAction;
  /** Tone token for the leading severity dot. */
  tone: string;
}

/**
 * Build the overview verdict from analytics + the latest weight trend. Priority:
 * inactivity (gravest) → no sessions this week → positive momentum → steady.
 */
export function computeVerdict(
  analytics: ClientAnalytics | null,
  weights: readonly BodyWeightEntry[]
): ClientVerdict {
  if (!analytics) {
    return { sentence: 'אין עדיין נתוני פעילות', action: 'none', tone: 'var(--fs-muted)' };
  }
  const days = analytics.daysSinceActivity;
  if (analytics.level === 'new') {
    return {
      sentence: 'עדיין לא נרשם אימון — שלחו ברכת פתיחה',
      action: 'message',
      tone: 'var(--fs-muted)',
    };
  }
  if (analytics.level === 'inactive' && days != null) {
    return {
      sentence: `לא התאמן ${days} ימים — שווה לבדוק מה קורה`,
      action: 'message',
      tone: 'var(--fs-warn)',
    };
  }
  if (analytics.level === 'at_risk') {
    return {
      sentence: 'ללא אימון השבוע — שלחו תזכורת',
      action: 'message',
      tone: 'var(--fs-warn)',
    };
  }
  // Active: lead with weight momentum when meaningful, else a steady affirmation.
  const trend = weightDelta(weights);
  if (trend != null && Math.abs(trend) >= WEIGHT_TREND_MIN_DELTA) {
    const dir = trend < 0 ? 'ירד' : 'עלה';
    return {
      sentence: `${pluralizeHe(analytics.sessionsLast7, HE_NOUNS.workout)} השבוע · המשקל ${dir} ${Math.abs(trend)} ק"ג`,
      action: 'none',
      tone: 'var(--fs-accent)',
    };
  }
  return {
    sentence: `על המסלול · ${pluralizeHe(analytics.sessionsLast7, HE_NOUNS.workout)} השבוע`,
    action: 'none',
    tone: 'var(--fs-accent)',
  };
}

/** Newest-minus-oldest weight delta (kg, 1 dp) across loaded entries, or null. */
function weightDelta(weights: readonly BodyWeightEntry[]): number | null {
  const valid = weights.filter((w) => Number.isFinite(w.weight));
  if (valid.length < 2) return null;
  // `weights` arrives newest-first: index 0 is current, last is oldest.
  const current = valid[0]?.weight;
  const oldest = valid[valid.length - 1]?.weight;
  if (current == null || oldest == null) return null;
  return Math.round((current - oldest) * 10) / 10;
}

function lastActivityLabel(analytics: ClientAnalytics | null): string {
  if (!analytics || analytics.daysSinceActivity == null) return '—';
  if (analytics.daysSinceActivity === 0) return 'היום';
  return `לפני ${analytics.daysSinceActivity} ימים`;
}

interface StreakStripProps {
  /** Week-adherence data fetched ONCE by OverviewTab (shared with WeekGrid). */
  days: DayAdherence[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/** Adherence streaks rendered as OverviewStat-style cells. */
function StreakStrip({ days, loading, error, onRetry }: StreakStripProps) {
  if (loading) return null; // WeekGrid above already shows the loading state for this window.
  if (error) return <SectionError onRetry={onRetry} />;
  if (days.length === 0) return <InlineEmpty>אין נתוני רצף.</InlineEmpty>;

  const streaks = computeStreaks(days);
  return (
    <div className="grid grid-cols-3 gap-2">
      <OverviewStat label="רצף אימונים" value={streaks.currentWorkout} color="var(--fs-accent)" />
      <OverviewStat label="רצף שיא" value={streaks.longestWorkout} />
      <OverviewStat label="רצף עמידה ביעד" value={streaks.currentOnTarget} />
    </div>
  );
}

/** Composed verdict strip: severity dot + Hebrew sentence + relevant action. */
function VerdictStrip({ verdict, onMessage }: { verdict: ClientVerdict; onMessage: () => void }) {
  return (
    <div
      className="flex items-center gap-3"
      style={{
        padding: '12px 14px',
        marginBottom: 12,
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 8,
          height: 8,
          borderRadius: 999,
          background: verdict.tone,
        }}
      />
      <p
        dir="auto"
        style={{
          flex: 1,
          minWidth: 0,
          margin: 0,
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--fs-ink)',
          lineHeight: 1.4,
        }}
      >
        {verdict.sentence}
      </p>
      {verdict.action === 'message' && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onMessage}
          className="shrink-0 whitespace-nowrap"
        >
          <MessageSquare size={14} aria-hidden="true" />
          שלחו הודעה
        </Button>
      )}
    </div>
  );
}

export function OverviewTab({
  clientId,
  link,
  analytics,
  latestWeight,
  weights,
  onMessage,
  onPaused,
}: OverviewTabProps) {
  const [confirmPause, setConfirmPause] = useState(false);
  const [busy, setBusy] = useState(false);
  const verdict = computeVerdict(analytics, weights);

  // ONE week-adherence fetch shared by WeekGrid + StreakStrip (it aggregates
  // 4 queries — running it twice doubled the load). `[clientId]` re-fetches
  // when navigating between clients.
  const adherenceQ = useAsyncData<DayAdherence[]>(
    () => getClientWeekAdherence(clientId),
    [],
    [clientId]
  );

  const pause = async () => {
    if (!link) return;
    setBusy(true);
    const { error } = await setClientStatus(link.id, 'paused');
    setBusy(false);
    setConfirmPause(false);
    if (error) {
      showToast('השהיית המתאמן נכשלה', 'error');
      return;
    }
    showToast('המתאמן הושהה', 'success');
    onPaused();
  };

  return (
    <>
      <VerdictStrip verdict={verdict} onMessage={onMessage} />

      <Section title="תקציר">
        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="מצב"
            value={analytics ? clientStatusMeta(analytics.level).label : '—'}
            color={analytics ? clientStatusMeta(analytics.level).color : undefined}
          />
          <Stat
            label="אימונים (7 ימים)"
            value={analytics ? String(analytics.sessionsLast7) : '—'}
          />
          <Stat label="פעילות אחרונה" value={lastActivityLabel(analytics)} />
          <Stat label="משקל אחרון" value={latestWeight ? `${latestWeight} ק"ג` : '—'} />
        </div>
      </Section>

      <Section title="השבוע במבט-על">
        <WeekGrid
          days={adherenceQ.data}
          loading={adherenceQ.loading}
          error={adherenceQ.error}
          onRetry={adherenceQ.reload}
        />
      </Section>

      <Section title="רצפים">
        <StreakStrip
          days={adherenceQ.data}
          loading={adherenceQ.loading}
          error={adherenceQ.error}
          onRetry={adherenceQ.reload}
        />
      </Section>

      {link && link.status === 'active' && (
        <Section title="ניהול">
          <Button
            variant="secondary"
            fullWidth
            isLoading={busy}
            onClick={() => setConfirmPause(true)}
          >
            השהיית מתאמן
          </Button>
          <ConfirmDialog
            isOpen={confirmPause}
            variant="danger"
            title="השהיית מתאמן"
            description="המתאמן יעבור למצב מושהה ולא יקבל שיוכים חדשים עד לחידוש הקשר. אפשר להחזיר אותו לפעיל בכל עת."
            confirmLabel="השהיה"
            onConfirm={pause}
            onCancel={() => setConfirmPause(false)}
          />
        </Section>
      )}
    </>
  );
}

export default OverviewTab;
