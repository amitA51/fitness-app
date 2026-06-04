// ============================================================================
// COACH INVITES — create / share / revoke invites
// ============================================================================

import { Copy, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import { showToast } from '../../components/ui/GlobalToast';
import { Input } from '../../components/ui/Input';
import {
  createInvite,
  getSeatUsage,
  inviteLink,
  listInvites,
  revokeInvite,
} from '../../services/coach';
import type { CoachInvite, InviteStatus } from '../../types/coach';
import { CoachPage, ListSkeleton, Section, formatDate, useAsyncData } from './_shared';

// Invite status → Hebrew (never surface the raw English enum in the meta line).
const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  pending: 'ממתינה',
  accepted: 'התקבלה',
  revoked: 'בוטלה',
  expired: 'פגה',
};

export default function CoachInvites() {
  const { data: invites, loading, reload } = useAsyncData<CoachInvite[]>(() => listInvites(), []);
  const { data: seats, reload: reloadSeats } = useAsyncData(() => getSeatUsage(), {
    used: 0,
    limit: 0,
    full: false,
  });
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);

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

  const confirmRevoke = async () => {
    if (!revokeId) return;
    await revokeInvite(revokeId);
    setRevokeId(null);
    reload();
    showToast('ההזמנה בוטלה', 'success');
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
        <div className="mb-2">
          <Input
            type="email"
            inputMode="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com (אופציונלי)"
            aria-label="אימייל מתאמן"
          />
        </div>
        <Button variant="primary" fullWidth isLoading={busy} onClick={handleCreate}>
          צור קוד הזמנה
        </Button>
      </Section>

      <Section title="הזמנות פתוחות">
        {loading ? (
          <ListSkeleton rows={3} />
        ) : invites.length === 0 ? (
          <EmptyState
            illustration="generic"
            title="אין הזמנות עדיין"
            description="צור קוד הזמנה כדי לחבר מתאמן חדש."
          />
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
                    textAlign: 'start',
                  }}
                >
                  {inv.code}
                </div>
                <div
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fs-muted)' }}
                >
                  {inv.email ?? 'קוד משותף'} · {INVITE_STATUS_LABEL[inv.status] ?? inv.status} ·
                  תוקף {formatDate(inv.expiresAt)}
                </div>
              </div>
              {inv.status === 'pending' && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="העתק קישור"
                    onClick={() => copy(inv.code)}
                    className="shrink-0"
                  >
                    <Copy size={16} aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="בטל הזמנה"
                    onClick={() => setRevokeId(inv.id)}
                    className="shrink-0"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </Button>
                </>
              )}
            </div>
          ))
        )}
      </Section>

      <ConfirmDialog
        isOpen={revokeId !== null}
        variant="danger"
        title="ביטול הזמנה"
        description="הקוד יפסיק לעבוד מיידית. לא ניתן לשחזר הזמנה שבוטלה."
        confirmLabel="בטל הזמנה"
        cancelLabel="חזרה"
        onConfirm={confirmRevoke}
        onCancel={() => setRevokeId(null)}
      />
    </CoachPage>
  );
}
