// ============================================================================
// COACH GROUPS — segments + bulk announcements
// ============================================================================
// A group assignment/announcement is a single row visible to all members via
// RLS (is_group_member) — no per-member duplication.

import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../components/ui/GlobalToast';
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
import { CoachPage, EmptyHint, Section, useAsyncData } from './_shared';

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
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="שם הקבוצה"
            className="flex-1 px-3 py-2"
            style={{
              background: 'var(--fs-surface)',
              border: '1px solid var(--fs-surface-2)',
              color: 'var(--fs-ink)',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
            }}
          />
          <Button variant="primary" onClick={create}>
            צור
          </Button>
        </div>
      </Section>

      <Section title="הקבוצות שלי">
        {loading ? (
          <EmptyHint>טוען…</EmptyHint>
        ) : groups.length === 0 ? (
          <EmptyHint>אין קבוצות עדיין.</EmptyHint>
        ) : (
          groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelected(selected?.id === g.id ? null : g)}
              className="w-full text-right px-4 py-3 mb-2"
              style={{
                background: 'var(--fs-surface)',
                border: '1px solid var(--fs-surface-2)',
                color: 'var(--fs-ink)',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
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

  return (
    <Section title={`עריכת "${group.name}"`}>
      <div className="mb-3">
        {clients.length === 0 ? (
          <EmptyHint>אין מתאמנים פעילים להוספה.</EmptyHint>
        ) : (
          clients.map((c) => (
            <label
              key={c.id}
              className="flex items-center gap-3 px-4 py-2.5 mb-1.5"
              style={{
                background: 'var(--fs-surface)',
                border: '1px solid var(--fs-surface-2)',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={members.has(c.clientId)}
                onChange={() => toggle(c.clientId)}
              />
              <span
                style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--fs-ink)' }}
              >
                {c.clientProfile?.displayName ?? 'מתאמן'}
              </span>
            </label>
          ))
        )}
      </div>
      <Button variant="primary" fullWidth isLoading={busy} onClick={saveMembers}>
        שמור חברים
      </Button>

      <div className="mt-4">
        <textarea
          value={announcement}
          onChange={(e) => setAnnouncement(e.target.value)}
          rows={2}
          placeholder="הודעה לכל חברי הקבוצה…"
          className="w-full mb-2 px-3 py-2"
          style={{
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-surface-2)',
            color: 'var(--fs-ink)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
          }}
        />
        <Button variant="secondary" fullWidth isLoading={busy} onClick={broadcast}>
          שלח הודעה לקבוצה
        </Button>
      </div>

      <button
        type="button"
        onClick={async () => {
          await deleteGroup(group.id);
          onDeleted();
        }}
        className="w-full mt-3 py-2"
        style={{
          background: 'transparent',
          color: 'var(--fs-muted)',
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
        }}
      >
        מחק קבוצה
      </button>
    </Section>
  );
}
