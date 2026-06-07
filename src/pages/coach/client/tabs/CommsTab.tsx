// ============================================================================
// CLIENT 360 — Communications tab (תקשורת)
// ============================================================================
// Private notes, reminders (active links only), the unified activity timeline,
// and the audit trail.

import type { CheckIn } from '../../../../services/coach';
import type { WorkoutSession } from '../../../../types';
import type { Assignment, CoachClient } from '../../../../types/coach';
import { Section } from '../../_shared';
import { AuditBox } from '../AuditBox';
import { NotesBox } from '../NotesBox';
import { RemindersBox } from '../RemindersBox';
import { TimelineBox } from '../TimelineBox';

interface CommsTabProps {
  clientId: string;
  link: CoachClient | null;
  sessions: WorkoutSession[];
  checkIns: CheckIn[];
  assignments: Assignment[];
}

export function CommsTab({ clientId, link, sessions, checkIns, assignments }: CommsTabProps) {
  return (
    <>
      <NotesBox clientId={clientId} />

      {link && link.status === 'active' && <RemindersBox clientId={clientId} />}

      <Section title="ציר פעילות">
        <TimelineBox sessions={sessions} checkIns={checkIns} assignments={assignments} />
      </Section>

      <AuditBox clientId={clientId} />
    </>
  );
}

export default CommsTab;
