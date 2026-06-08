// ============================================================================
// SETTINGS · BLOCKED USERS — משתמשים חסומים
//
// Lists the people the current user has blocked (listBlockedUsers) and lets
// them unblock each one (unblockUser) with optimistic removal. Matches the
// settings section-card idiom (SectionLabel + CARD_STYLE) used across Settings.
//
// FAIL-SAFE-INERT: the service never throws — it returns safe defaults. An
// empty list could mean "nobody blocked" OR "service unconfigured"; we treat
// a successful empty result as the empty state and only show the error state
// when the service signals a failure via the { error } envelope on a refetch.
//
// All four data states: loading / empty ("לא חסמת אף אחד") / error / success.
// RTL Hebrew-first. Fresh Steel / Obsidian design system.
// ============================================================================

import { Loader2, UserX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import { listBlockedUsers, unblockUser } from '../../../services/community/communityService';
import type { BlockedUser } from '../../../services/community/types';

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--fs-surface)',
  borderRadius: 'var(--radius-asymmetric)',
  overflow: 'hidden',
  padding: 20,
};

const HELPER_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  color: 'var(--fs-muted)',
  margin: 0,
  lineHeight: 1.5,
};

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  paddingBlock: 12,
};

type LoadState = 'loading' | 'error' | 'ready';

export function BlockedUsersSection() {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [users, setUsers] = useState<BlockedUser[]>([]);
  // id currently being unblocked → disables just that row's button.
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadState('loading');
    setRowError(null);
    try {
      const list = await listBlockedUsers();
      setUsers(list);
      setLoadState('ready');
    } catch {
      // The service is fail-safe and shouldn't throw, but guard anyway.
      setLoadState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleUnblock = useCallback(async (userId: string) => {
    setPendingId(userId);
    setRowError(null);
    // Optimistic removal — snapshot first so we can restore on failure.
    let removed: BlockedUser | undefined;
    setUsers((prev) => {
      removed = prev.find((u) => u.userId === userId);
      return prev.filter((u) => u.userId !== userId);
    });

    const { error } = await unblockUser(userId);
    setPendingId(null);
    if (error) {
      // Restore the row at its original position is overkill; re-appending keeps
      // it visible so the user can retry. Order is not load-bearing here.
      setUsers((prev) => (removed ? [...prev, removed] : prev));
      setRowError('ביטול החסימה נכשל. נסו שוב.');
    }
  }, []);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loadState === 'loading') {
    return (
      <div className="mb-7">
        <SectionLabel>משתמשים חסומים</SectionLabel>
        <div style={CARD_STYLE} aria-busy="true">
          <div
            className="animate-pulse"
            style={{ height: 44, borderRadius: 10, background: 'var(--fs-surface-2)' }}
          />
          <div
            className="animate-pulse"
            style={{
              height: 44,
              borderRadius: 10,
              background: 'var(--fs-surface-2)',
              marginTop: 12,
            }}
          />
        </div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (loadState === 'error') {
    return (
      <div className="mb-7">
        <SectionLabel>משתמשים חסומים</SectionLabel>
        <div style={CARD_STYLE}>
          <p role="alert" style={{ ...HELPER_STYLE, color: 'var(--fs-error)' }}>
            לא ניתן לטעון את רשימת החסומים כרגע.
          </p>
          <button
            type="button"
            onClick={load}
            className="focus-ring active:scale-[0.98]"
            style={{
              marginTop: 12,
              minHeight: 44,
              padding: '10px 20px',
              borderRadius: 12,
              border: 'none',
              background: 'var(--fs-accent)',
              color: 'var(--color-ink-on-accent)',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            נסו שוב
          </button>
        </div>
      </div>
    );
  }

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (users.length === 0) {
    return (
      <div className="mb-7">
        <SectionLabel>משתמשים חסומים</SectionLabel>
        <div style={CARD_STYLE}>
          <div
            role="status"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              padding: '16px 0',
              textAlign: 'center',
            }}
          >
            <UserX
              size={32}
              aria-hidden="true"
              style={{ color: 'var(--fs-muted)', opacity: 0.5 }}
            />
            <p style={HELPER_STYLE}>לא חסמת אף אחד</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Success ───────────────────────────────────────────────────────────────
  return (
    <div className="mb-7">
      <SectionLabel>משתמשים חסומים</SectionLabel>
      <div style={CARD_STYLE}>
        <ul aria-label="רשימת משתמשים חסומים" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {users.map((user, index) => {
            const name = user.displayName ?? 'משתמש';
            const isPending = pendingId === user.userId;
            return (
              <li
                key={user.userId}
                style={{
                  ...ROW_STYLE,
                  borderTop: index === 0 ? 'none' : '1px solid var(--fs-surface-2)',
                }}
              >
                <span
                  style={{
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontFamily: 'var(--font-body)',
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--fs-ink)',
                  }}
                >
                  {name}
                </span>
                <button
                  type="button"
                  onClick={() => handleUnblock(user.userId)}
                  disabled={isPending}
                  aria-label={`ביטול חסימה של ${name}`}
                  className="focus-ring active:scale-[0.98] inline-flex items-center gap-2"
                  style={{
                    flexShrink: 0,
                    minHeight: 44,
                    padding: '8px 16px',
                    borderRadius: 999,
                    border: '1px solid var(--fs-surface-2)',
                    background: 'var(--fs-bg)',
                    color: 'var(--fs-ink)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: isPending ? 'default' : 'pointer',
                    opacity: isPending ? 0.6 : 1,
                  }}
                >
                  {isPending && <Loader2 size={14} aria-hidden="true" className="animate-spin" />}
                  {isPending ? 'מבטל…' : 'ביטול חסימה'}
                </button>
              </li>
            );
          })}
        </ul>

        {rowError && (
          <p role="alert" style={{ ...HELPER_STYLE, color: 'var(--fs-error)', marginTop: 12 }}>
            {rowError}
          </p>
        )}
      </div>
    </div>
  );
}

export default BlockedUsersSection;
