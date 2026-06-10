// ============================================================================
// CLIENT 360 — Overview tab (סקירה)
// ============================================================================
// At-a-glance state: 4 stat cards, the 7-day adherence grid, an adherence-streak
// strip, and the "pause trainee" management action (active links only).

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
import type { CoachClient } from '../../../../types/coach';
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
  /** Called after a successful status change so the orchestrator can navigate away. */
  onPaused: () => void;
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

export function OverviewTab({
  clientId,
  link,
  analytics,
  latestWeight,
  onPaused,
}: OverviewTabProps) {
  const [confirmPause, setConfirmPause] = useState(false);
  const [busy, setBusy] = useState(false);

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
