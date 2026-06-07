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
  getGroupMemberCounts,
  getGroupMemberIds,
  listClients,
  listGroups,
  setGroupMembers,
} from '../../services/coach';
import type { ClientGroup, CoachClient } from '../../types/coach';
import ProgramBuilder from './ProgramBuilder';
import { Checkbox, CoachPage, ListSkeleton, Section, SectionError, useAsyncData } from './_shared';

export default function CoachGroups() {
  const {
    data: groups,
    loading,
    error,
    reload,
  } = useAsyncData<ClientGroup[]>(() => listGroups(), []);
  const { data: clients } = useAsyncData<CoachClient[]>(() => listClients('active'), []);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<ClientGroup | null>(null);
  const [memberCounts, setMemberCounts] = useState<Map<string, number>>(new Map());

  // Fetch member counts once groups are loaded.
  useEffect(() => {
    if (groups.length === 0) return;
    void getGroupMemberCounts(groups.map((g) => g.id)).then(setMemberCounts);
  }, [groups]);

  const refreshCounts = () => {
    if (groups.length === 0) return;
    void getGroupMemberCounts(groups.map((g) => g.id)).then(setMemberCounts);
  };

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
              label="שם הקבוצה"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="למשל: מתאמני בוקר"
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
        ) : error ? (
          <SectionError onRetry={reload} />
        ) : groups.length === 0 ? (
          <EmptyState
            illustration="habits"
            title="אין קבוצות עדיין"
            description="צור קבוצה כדי לשלוח הודעות והמלצות לכמה מתאמנים יחד."
          />
        ) : (
          groups.map((g) => {
            const isSelected = selected?.id === g.id;
            const count = memberCounts.get(g.id);
            const countLabel =
              count === undefined
                ? null
                : count === 0
                  ? 'אין חברים'
                  : count === 1
                    ? 'חבר אחד'
                    : `${count} חברים`;
            return (
              <button
                key={g.id}
                type="button"
                aria-expanded={isSelected}
                onClick={() => setSelected(isSelected ? null : g)}
                className="w-full text-right px-4 py-3 mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-0"
                style={{
                  background: isSelected ? 'var(--fs-primary)' : 'var(--fs-surface)',
                  border: isSelected
                    ? '1px solid var(--fs-accent)'
                    : '1px solid var(--fs-surface-2)',
                  color: isSelected ? 'var(--fs-accent)' : 'var(--fs-ink)',
                  fontFamily: 'var(--font-body)',
                  fontWeight: 600,
                  minHeight: 44,
                }}
              >
                <span className="block">{g.name}</span>
                {countLabel !== null && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--fs-muted)',
                      fontWeight: 400,
                    }}
                  >
                    {count !== undefined && count > 1 ? (
                      <>
                        <span dir="ltr">{count}</span> חברים
                      </>
                    ) : (
                      countLabel
                    )}
                  </span>
                )}
              </button>
            );
          })
        )}
      </Section>

      {selected && (
        <GroupEditor
          group={selected}
          clients={clients}
          onSaved={refreshCounts}
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
  onSaved,
  onDeleted,
}: {
  group: ClientGroup;
  clients: CoachClient[];
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [members, setMembers] = useState<Set<string>>(new Set());
  const [announcement, setAnnouncement] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [programOpen, setProgramOpen] = useState(false);

  const allClientIds = clients.map((c) => c.clientId);

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
    showToast(error ? 'שמירת חברי הקבוצה נכשלה' : 'חברי הקבוצה נשמרו', error ? 'error' : 'success');
    if (!error) onSaved();
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
          <>
            <div className="flex gap-4 mb-2">
              <button
                type="button"
                onClick={() => setMembers(new Set(allClientIds))}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--fs-accent)',
                  background: 'none',
                  border: 'none',
                  padding: '10px 0',
                  minHeight: 44,
                  cursor: 'pointer',
                }}
              >
                בחירת הכול
              </button>
              <button
                type="button"
                onClick={() => setMembers(new Set())}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--fs-accent)',
                  background: 'none',
                  border: 'none',
                  padding: '10px 0',
                  minHeight: 44,
                  cursor: 'pointer',
                }}
              >
                ניקוי הבחירה
              </button>
            </div>
            {clients.map((c) => (
              <Checkbox
                key={c.id}
                checked={members.has(c.clientId)}
                onChange={() => toggle(c.clientId)}
                label={c.clientProfile?.displayName ?? 'מתאמן'}
              />
            ))}
          </>
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

      <div className="mt-4">
        <Button variant="primary" fullWidth onClick={() => setProgramOpen(true)}>
          שיוך תוכנית לקבוצה
        </Button>
      </div>

      <ProgramBuilder
        groupId={group.id}
        isOpen={programOpen}
        onClose={() => setProgramOpen(false)}
      />

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
