// ============================================================================
// COACH INVITES — create / share / revoke invites
// ============================================================================

import { Copy, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../components/workout/components/ui/Toast';
import {
  createInvite,
  getSeatUsage,
  inviteLink,
  listInvites,
  revokeInvite,
} from '../../services/coach';
import type { CoachInvite } from '../../types/coach';
import { CoachPage, EmptyHint, Section, formatDate, useAsyncData } from './_shared';

export default function CoachInvites() {
  const { data: invites, loading, reload } = useAsyncData<CoachInvite[]>(() => listInvites(), []);
  const { data: seats, reload: reloadSeats } = useAsyncData(() => getSeatUsage(), {
    used: 0,
    limit: 0,
    full: false,
  });
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    setBusy(true);
    try {
      await createInvite(email || undefined);
      setEmail('');
      reload();
      reloadSeats();
      showToast('הזמנה נוצרה', 'success');
    } catch {
      showToast('יצירת ההזמנה נכשלה', 'error');
    } finally {
      setBusy(false);
    }
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      showToast('הקישור הועתק', 'success');
    } catch {
      showToast('ההעתקה נכשלה', 'error');
    }
  };

  return (
    <CoachPage title="הזמנות" subtitle={`${seats.used}/${seats.limit} מושבים`}>
      <Section title="הזמנה חדשה">
        {seats.full && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--fs-muted)',
              marginBottom: 10,
            }}
          >
            הגעת למכסת המושבים. שדרג את המנוי כדי להוסיף מתאמנים.
          </p>
        )}
        <input
          type="email"
          inputMode="email"
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com (אופציונלי)"
          className="w-full mb-2 px-3 py-3"
          style={{
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-surface-2)',
            color: 'var(--fs-ink)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
          }}
        />
        <Button variant="primary" fullWidth isLoading={busy} onClick={handleCreate}>
          צור קוד הזמנה
        </Button>
      </Section>

      <Section title="הזמנות פתוחות">
        {loading ? (
          <EmptyHint>טוען…</EmptyHint>
        ) : invites.length === 0 ? (
          <EmptyHint>אין הזמנות עדיין.</EmptyHint>
        ) : (
          invites.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center gap-3 px-4 py-3 mb-2"
              style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-surface-2)' }}
            >
              <div className="flex-1 min-w-0">
                <div
                  dir="ltr"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    color: 'var(--fs-heading)',
                  }}
                >
                  {inv.code}
                </div>
                <div
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fs-muted)' }}
                >
                  {inv.email ?? 'קוד משותף'} · {inv.status} · תוקף {formatDate(inv.expiresAt)}
                </div>
              </div>
              {inv.status === 'pending' && (
                <>
                  <button
                    type="button"
                    aria-label="העתק קישור"
                    onClick={() => copy(inv.code)}
                    style={iconBtn}
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="בטל הזמנה"
                    onClick={async () => {
                      await revokeInvite(inv.id);
                      reload();
                    }}
                    style={iconBtn}
                  >
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          ))
        )}
      </Section>
    </CoachPage>
  );
}

const iconBtn: React.CSSProperties = {
  width: 34,
  height: 34,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--fs-surface-2)',
  color: 'var(--fs-heading)',
  flexShrink: 0,
};
