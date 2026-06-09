// Fresh Steel / Obsidian design system — coach private-notes box

import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { showToast } from '../../../components/ui/GlobalToast';
import { Textarea } from '../../../components/ui/Textarea';
import { addCoachNote, listCoachNotes } from '../../../services/coach';
import {
  InlineEmpty,
  ListRow,
  ListSkeleton,
  Section,
  SectionError,
  formatDate,
  useAsyncData,
} from '../_shared';

export function NotesBox({ clientId }: { clientId: string }) {
  const { data: notes, loading, error, reload } = useAsyncData(() => listCoachNotes(clientId), []);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const canAdd = body.trim().length > 0;

  const add = async () => {
    if (!canAdd) return;
    setBusy(true);
    const { error } = await addCoachNote(clientId, body);
    setBusy(false);
    if (error) {
      showToast('שמירת ההערה נכשלה', 'error');
      return;
    }
    setBody('');
    reload();
  };

  return (
    <Section title="הערות פרטיות">
      <div className="mb-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="הערה פרטית (רק אתה רואה)…"
          aria-label="הערה פרטית"
        />
      </div>
      <Button variant="secondary" fullWidth isLoading={busy} disabled={!canAdd} onClick={add}>
        הוסף הערה
      </Button>
      <div className="mt-2">
        {loading ? (
          <ListSkeleton rows={2} />
        ) : error ? (
          <SectionError onRetry={reload} />
        ) : notes.length === 0 ? (
          <InlineEmpty>אין הערות</InlineEmpty>
        ) : (
          notes.map((n) => (
            <ListRow key={n.id} label={n.body} meta={formatDate(n.createdAt)} />
          ))
        )}
      </div>
    </Section>
  );
}
