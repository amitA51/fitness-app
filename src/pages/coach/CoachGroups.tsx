// ============================================================================
// COACH GROUPS — segments + bulk announcements
// ============================================================================
// A group assignment/announcement is a single row visible to all members via
// RLS (is_group_member) — no per-member duplication.

import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import { showToast } from '../../components/ui/GlobalToast';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import {
  createAssignment,
  createGroup,
  deleteGroup,
  getGroupMemberIds,
  listClients,
  listGroups,
  setGroupMembers,
} from '../../services/coach';
import type { ClientGroup, CoachClient } from '../../types/coach';
import { Checkbox, CoachPage, ListSkeleton, Section, useAsyncData } from './_shared';

export default function CoachGroups() {
  const { data: groups, loading, reload } = useAsyncData<ClientGroup[]>(() => listGroups(), []);
  const { data: clients } = useAsyncData<CoachClient[]>(() => listClients('active'), []);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<ClientGroup | null>(null);

  const create = async () => {
    if (!name.trim()) return;
    await createGroup(name);
    setName('');
    reload();
  };

  return (
    <CoachPage title="קבוצות" subtitle="Groups">
      <Section title="קבוצה חדשה">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם הקבוצה"
              aria-label="שם הקבוצה"
            />
          </div>
          <Button variant="primary" onClick={create}>
            צור
          </Button>
        </div>
      </Section>

      <Section title="הקבוצות שלי">
        {loading ? (
          <ListSkeleton rows={3} />
        ) : groups.length === 0 ? (
          <EmptyState
            illustration="habits"
            title="אין קבוצות עדיין"
            description="צור קבוצה כדי לשלוח הודעות והמלצות לכמה מתאמנים יחד."
          />
        ) : (
          groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelected(selected?.id === g.id ? null : g)}
              className="w-full text-right px-4 py-3 mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-0"
              style={{
                background: 'var(--fs-surface)',
                border: '1px solid var(--fs-surface-2)',
                color: 'var(--fs-ink)',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                minHeight: 44,
              }}
            >
              {g.name}
            </button>
          ))
        )}
      </Section>

      {selected && (
        <GroupEditor
          group={selected}
          clients={clients}
          onDeleted={() => {
            setSelected(null);
            reload();
          }}
        />
      )}
    </CoachPage>
  );
}

function GroupEditor({
  group,
  clients,
  onDeleted,
}: {
  group: ClientGroup;
  clients: CoachClient[];
  onDeleted: () => void;
}) {
  const [members, setMembers] = useState<Set<string>>(new Set());
  const [announcement, setAnnouncement] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    void getGroupMemberIds(group.id).then((ids) => setMembers(new Set(ids)));
  }, [group.id]);

  const toggle = (clientId: string) => {
    setMembers((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const saveMembers = async () => {
    setBusy(true);
    const { error } = await setGroupMembers(group.id, [...members]);
    setBusy(false);
    showToast(error ? 'שמירת החברים נכשלה' : 'החברים נשמרו', error ? 'error' : 'success');
  };

  const broadcast = async () => {
    if (!announcement.trim()) return;
    setBusy(true);
    try {
      await createAssignment({
        kind: 'announcement',
        title: group.name,
        payload: { text: announcement.trim() },
        groupId: group.id,
      });
      setAnnouncement('');
      showToast('ההודעה נשלחה לקבוצה', 'success');
    } catch {
      showToast('השליחה נכשלה', 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmDeleteGroup = async () => {
    await deleteGroup(group.id);
    setConfirmDelete(false);
    onDeleted();
  };

  return (
    <Section title={`עריכת "${group.name}"`}>
      <div className="mb-3">
        {clients.length === 0 ? (
          <EmptyState illustration="generic" size="small" title="אין מתאמנים פעילים להוספה" />
        ) : (
          clients.map((c) => (
            <Checkbox
              key={c.id}
              checked={members.has(c.clientId)}
              onChange={() => toggle(c.clientId)}
              label={c.clientProfile?.displayName ?? 'מתאמן'}
            />
          ))
        )}
      </div>
      <Button variant="primary" fullWidth isLoading={busy} onClick={saveMembers}>
        שמור חברים
      </Button>

      <div className="mt-4">
        <div className="mb-2">
          <Textarea
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            rows={2}
            placeholder="הודעה לכל חברי הקבוצה…"
            aria-label="הודעה לקבוצה"
          />
        </div>
        <Button variant="secondary" fullWidth isLoading={busy} onClick={broadcast}>
          שלח הודעה לקבוצה
        </Button>
      </div>

      <Button
        variant="ghost"
        fullWidth
        className="mt-3"
        style={{ color: 'var(--fs-muted)' }}
        onClick={() => setConfirmDelete(true)}
      >
        מחק קבוצה
      </Button>

      <ConfirmDialog
        isOpen={confirmDelete}
        variant="danger"
        title="מחיקת קבוצה"
        description={`הקבוצה "${group.name}" תימחק לצמיתות. החברים יישארו מתאמנים פעילים.`}
        confirmLabel="מחק"
        cancelLabel="חזרה"
        onConfirm={confirmDeleteGroup}
        onCancel={() => setConfirmDelete(false)}
      />
    </Section>
  );
}
