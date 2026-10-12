// ============================================================================
// CLIENT 360 — Training tab (אימונים)
// ============================================================================
// Volume trend, the 4-week cardio totals, the weekly schedule planner, recent
// sessions (with per-row edit + add), the program builder trigger, and the
// assignment surfaces.

import { BarChart3, Dumbbell, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import type { ClientAnalytics } from '../../../../services/coach';
import type { WorkoutSession } from '../../../../types';
import { HE_NOUNS, pluralizeHe } from '../../../../utils/pluralizeHe';
import { TrendChartCard } from '../../../progress/components/TrendChartCard';
import ProgramBuilder from '../../ProgramBuilder';
import { InlineEmpty, ListRow, ListSkeleton, Section, formatDate } from '../../_shared';
import { RowIconBtn } from '../../rosterPrimitives';
import { AssignBox } from '../AssignBox';
import { AssignmentsBox } from '../AssignmentsBox';
import { EditSessionSheet } from '../EditSessionSheet';
import { ScheduleCalendar } from '../ScheduleCalendar';
import { volumeTrendPoints } from '../clientTrends';
import { CardioTotals, SessionCardioLine, sessionCardioView } from '../sessionCardio';

const metaLineStyle = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--fs-muted)',
} as const;

/** One recent-session row: a run reads as its time/distance, a lift as its volume. */
function SessionRow({ session, onEdit }: { session: WorkoutSession; onEdit: () => void }) {
  const date = formatDate(session.startTime);
  const cardio = sessionCardioView(session);
  const volume = Math.round(session.totalVolume);
  const lifting = [date];
  if (volume > 0) lifting.push(`${volume} ק״ג נפח`);
  lifting.push(pluralizeHe(session.exercises.length, HE_NOUNS.exercise));

  return (
    <ListRow
      label={session.notes || `${cardio.title ?? 'אימון'} · ${date}`}
      meta={cardio.cardioOnly ? undefined : lifting.join(' · ')}
      metaNode={
        cardio.pieces.length > 0 && (
          <div style={metaLineStyle}>
            {cardio.cardioOnly && date}
            <SessionCardioLine pieces={cardio.pieces} leadingDot={cardio.cardioOnly} />
          </div>
        )
      }
      trailing={
        <RowIconBtn onClick={onEdit} label={`עריכת אימון מ-${date}`}>
          <Pencil size={16} aria-hidden="true" />
        </RowIconBtn>
      }
    />
  );
}

interface TrainingTabProps {
  clientId: string;
  analytics: ClientAnalytics | null;
  sessions: WorkoutSession[];
  sessionsLoading: boolean;
  onSessionSaved: () => void;
}

export function TrainingTab({
  clientId,
  analytics,
  sessions,
  sessionsLoading,
  onSessionSaved,
}: TrainingTabProps) {
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<WorkoutSession | undefined>(undefined);
  const [sheetOpen, setSheetOpen] = useState(false);

  const openAdd = () => {
    setEditing(undefined);
    setSheetOpen(true);
  };
  const openEdit = (session: WorkoutSession) => {
    setEditing(session);
    setSheetOpen(true);
  };

  // A trainee who only ran this month has no lifting trend to show — a flat
  // zero chart would read as "stopped training". Their cardio says it instead.
  const cardioTotals = analytics?.cardioLast4Weeks ?? [];
  const showVolume =
    !!analytics && (cardioTotals.length === 0 || analytics.volumeByWeek.some((v) => v > 0));

  return (
    <>
      {showVolume && analytics && (
        <Section title="מגמת נפח · 4 שבועות">
          <TrendChartCard
            title="נפח אימונים"
            data={volumeTrendPoints(analytics.volumeByWeek)}
            icon={<BarChart3 size={14} style={{ color: 'var(--fs-accent)' }} aria-hidden="true" />}
            ariaLabel="מגמת נפח אימונים, 4 שבועות אחרונים"
          />
        </Section>
      )}

      {cardioTotals.length > 0 && (
        <Section title="אירובי · 4 שבועות">
          <div
            className="px-4 py-2.5"
            style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-surface-2)' }}
          >
            <CardioTotals totals={cardioTotals} />
          </div>
        </Section>
      )}

      <Section title="יומן אימונים">
        <ScheduleCalendar clientId={clientId} />
      </Section>

      <Section title="אימונים אחרונים">
        {sessionsLoading ? (
          <ListSkeleton rows={3} />
        ) : sessions.length === 0 ? (
          <InlineEmpty>אין אימונים מתועדים. אפשר להוסיף אימון ידנית למתאמן.</InlineEmpty>
        ) : (
          sessions.map((s) => <SessionRow key={s.id} session={s} onEdit={() => openEdit(s)} />)
        )}
        <Button variant="secondary" fullWidth onClick={openAdd} className="mt-2">
          <Plus size={16} aria-hidden="true" /> הוספת אימון
        </Button>
      </Section>

      <Section title="תוכנית אימון">
        <Button variant="primary" fullWidth onClick={() => setBuilderOpen(true)}>
          <Dumbbell size={16} aria-hidden="true" /> בנה תוכנית
        </Button>
      </Section>

      <AssignBox clientId={clientId} />
      <AssignmentsBox clientId={clientId} />

      <ProgramBuilder
        clientId={clientId}
        isOpen={builderOpen}
        onClose={() => setBuilderOpen(false)}
      />
      <EditSessionSheet
        clientId={clientId}
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={onSessionSaved}
        initial={editing}
      />
    </>
  );
}

export default TrainingTab;
