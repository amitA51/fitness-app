// Fresh Steel / Obsidian design system — active-assignments list with revoke ConfirmDialog

import { Archive } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { showToast } from '../../../components/ui/GlobalToast';
import { archiveAssignment, listCoachAssignments } from '../../../services/coach';
import type { Assignment } from '../../../types/coach';
import {
  InlineEmpty,
  ListRow,
  ListSkeleton,
  Section,
  SectionError,
  formatDate,
  useAsyncData,
} from '../_shared';

const KIND_LABEL: Record<Assignment['kind'], string> = {
  program: 'תוכנית אימון',
  nutrition_target: 'יעד תזונה',
  note: 'המלצה',
  announcement: 'הודעה',
};

export function AssignmentsBox({ clientId }: { clientId: string }) {
  const {
    data: assignments,
    loading,
    error,
    reload,
  } = useAsyncData<Assignment[]>(() => listCoachAssignments(clientId), [], [clientId]);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const active = assignments.filter((a) => a.status === 'active');

  const revoke = async (id: string) => {
    const { error } = await archiveAssignment(id);
    if (error) {
      showToast('ביטול השיוך נכשל', 'error');
      return;
    }
    showToast('השיוך בוטל', 'success');
    reload();
  };

  return (
    <Section title="שיוכים פעילים">
      {loading ? (
        <ListSkeleton rows={3} />
      ) : error ? (
        <SectionError onRetry={reload} />
      ) : active.length === 0 ? (
        <InlineEmpty>לא נשלחו שיוכים פעילים.</InlineEmpty>
      ) : (
        active.map((a) => (
          <ListRow
            key={a.id}
            label={a.title || KIND_LABEL[a.kind]}
            meta={`${KIND_LABEL[a.kind]} · ${formatDate(a.createdAt)}`}
            trailing={
              <Button
                variant="secondary"
                size="sm"
                icon={<Archive size={14} />}
                onClick={() => setConfirmRevokeId(a.id)}
              >
                בטל
              </Button>
            }
          />
        ))
      )}

      <ConfirmDialog
        isOpen={confirmRevokeId !== null}
        variant="warning"
        title="ביטול שיוך"
        description="השיוך יוסר מהמתאמן."
        confirmLabel="בטל שיוך"
        cancelLabel="חזרה"
        onConfirm={() => {
          const id = confirmRevokeId;
          setConfirmRevokeId(null);
          if (id) void revoke(id);
        }}
        onCancel={() => setConfirmRevokeId(null)}
      />
    </Section>
  );
}
