// ============================================================================
// CLIENT 360 — Training tab (אימונים)
// ============================================================================
// Volume trend, the weekly schedule planner, recent sessions (with per-row edit
// + add), the program builder trigger, and the assignment surfaces.

import { BarChart3, Dumbbell, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../../components/ui/Button';
import type { ClientAnalytics } from '../../../../services/coach';
import type { WorkoutSession } from '../../../../types';
import { TrendChartCard } from '../../../progress/components/TrendChartCard';
import ProgramBuilder from '../../ProgramBuilder';
import { InlineEmpty, ListRow, ListSkeleton, Section, formatDate } from '../../_shared';
import { RowIconBtn } from '../../rosterPrimitives';
import { AssignBox } from '../AssignBox';
import { AssignmentsBox } from '../AssignmentsBox';
import { EditSessionSheet } from '../EditSessionSheet';
import { ScheduleCalendar } from '../ScheduleCalendar';
import { volumeTrendPoints } from '../clientTrends';

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

  return (
    <>
      {analytics && (
        <Section title="מגמת נפח · 4 שבועות">
          <TrendChartCard
            title="נפח אימונים"
            data={volumeTrendPoints(analytics.volumeByWeek)}
            icon={<BarChart3 size={14} style={{ color: 'var(--fs-accent)' }} aria-hidden="true" />}
            ariaLabel="מגמת נפח אימונים, 4 שבועות אחרונים"
          />
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
          sessions.map((s) => (
            <ListRow
              key={s.id}
              label={s.notes || `אימון · ${formatDate(s.startTime)}`}
              meta={`${formatDate(s.startTime)} · ${Math.round(s.totalVolume)} ק"ג נפח · ${s.exercises.length} תרגילים`}
              trailing={
                <RowIconBtn
                  onClick={() => openEdit(s)}
                  label={`עריכת אימון מ-${formatDate(s.startTime)}`}
                >
                  <Pencil size={16} aria-hidden="true" />
                </RowIconBtn>
              }
            />
          ))
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
