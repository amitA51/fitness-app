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
  const [creating, setCreating] = useState(false);
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
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      await createGroup(name);
      setName('');
      reload();
      showToast('הקבוצה נוצרה', 'success');
    } catch {
      showToast('יצירת הקבוצה נכשלה', 'error');
    } finally {
      setCreating(false);
    }
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void create();
                }
              }}
              placeholder="למשל: מתאמני בוקר"
            />
          </div>
          <Button variant="primary" isLoading={creating} disabled={!name.trim()} onClick={create}>
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
  // Membership load state: saving an all-unchecked editor after a FAILED read
  // would call the atomic set_group_members RPC with an empty set and silently
  // wipe every member — so the save path stays disabled until 'ready'.
  const [membersState, setMembersState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [membersTick, setMembersTick] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  // Per-action busy flags — a shared flag made "save members" render the
  // broadcast button as loading too.
  const [savingMembers, setSavingMembers] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [programOpen, setProgramOpen] = useState(false);

  const allClientIds = clients.map((c) => c.clientId);

  // biome-ignore lint/correctness/useExhaustiveDependencies: membersTick is a retry counter that forces a refetch
  useEffect(() => {
    let cancelled = false;
    setMembersState('loading');
    getGroupMemberIds(group.id)
      .then((ids) => {
        if (cancelled) return;
        setMembers(new Set(ids));
        setMembersState('ready');
      })
      .catch(() => {
        if (!cancelled) setMembersState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [group.id, membersTick]);

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
    if (membersState !== 'ready' || savingMembers) return;
    setSavingMembers(true);
    try {
      const { error } = await setGroupMembers(group.id, [...members]);
      showToast(
        error ? 'שמירת חברי הקבוצה נכשלה' : 'חברי הקבוצה נשמרו',
        error ? 'error' : 'success'
      );
      if (!error) onSaved();
    } catch {
      showToast('שמירת חברי הקבוצה נכשלה', 'error');
    } finally {
      setSavingMembers(false);
    }
  };

  const broadcast = async () => {
    if (!announcement.trim()) return;
    setBroadcasting(true);
    try {
      await createAssignment({
        kind: 'announcement',
        title: group.name,
        payload: { text: announcement.trim() },
        groupId: group.id,
      });
      setAnnouncement('');
      showToast('העדכון נשלח לקבוצה', 'success');
    } catch {
      showToast('השליחה נכשלה', 'error');
    } finally {
      setBroadcasting(false);
    }
  };

  const confirmDeleteGroup = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const { error } = await deleteGroup(group.id);
      if (error) {
        // Keep the dialog open so the coach can retry or cancel.
        showToast('מחיקת הקבוצה נכשלה', 'error');
        return;
      }
      setConfirmDelete(false);
      onDeleted();
    } catch {
      showToast('מחיקת הקבוצה נכשלה', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Section title={`עריכת "${group.name}"`}>
      <div className="mb-3">
        {clients.length === 0 ? (
          <EmptyState illustration="generic" size="small" title="אין מתאמנים פעילים להוספה" />
        ) : membersState === 'loading' ? (
          <ListSkeleton rows={3} />
        ) : membersState === 'error' ? (
          <SectionError onRetry={() => setMembersTick((t) => t + 1)} />
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
      <Button
        variant="primary"
        fullWidth
        isLoading={savingMembers}
        disabled={membersState !== 'ready'}
        onClick={saveMembers}
      >
        שמור חברים
      </Button>

      <div className="mt-4">
        <div className="mb-2">
          <Textarea
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            rows={2}
            placeholder="עדכון לכל חברי הקבוצה…"
            aria-label="עדכון לקבוצה"
          />
        </div>
        <Button variant="secondary" fullWidth isLoading={broadcasting} onClick={broadcast}>
          שלח עדכון לקבוצה
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
