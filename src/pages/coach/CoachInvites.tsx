// ============================================================================
// COACH INVITES — create / share / revoke invites
// ============================================================================

import { Copy, QrCode, RotateCcw, Share2, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';
import { showToast } from '../../components/ui/GlobalToast';
import { Input } from '../../components/ui/Input';
import { Sheet } from '../../components/ui/Sheet';
import {
  createInvite,
  getSeatUsage,
  inviteLink,
  listInvites,
  revokeInvite,
} from '../../services/coach';
import type { CoachInvite, InviteStatus } from '../../types/coach';
import {
  CoachPage,
  ListSkeleton,
  Section,
  SectionError,
  formatDate,
  useAsyncData,
} from './_shared';

// Invite status → Hebrew (never surface the raw English enum in the meta line).
const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  pending: 'ממתינה',
  accepted: 'התקבלה',
  revoked: 'בוטלה',
  expired: 'פגה',
};

/** Sort pending invites to the top, preserving created_at desc within each band. */
const sortPendingFirst = (invites: CoachInvite[]): CoachInvite[] =>
  [...invites].sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'));

export default function CoachInvites() {
  const {
    data: invites,
    loading,
    error,
    reload,
  } = useAsyncData<CoachInvite[]>(() => listInvites(), []);
  const { data: seats, reload: reloadSeats } = useAsyncData(() => getSeatUsage(), {
    used: 0,
    limit: 0,
    full: false,
  });
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const [qrInvite, setQrInvite] = useState<CoachInvite | null>(null);

  const sorted = useMemo(() => sortPendingFirst(invites), [invites]);

  // Shared create path for the form and the per-row "recreate" action. The
  // server now also enforces seats on insert (trg_enforce_invite_seat_limit) —
  // map its typed rejection to a specific message, not the generic failure.
  const createWith = async (label?: string) => {
    if (seats.full) return; // a full coach must not mint codes that fail at accept-time
    setBusy(true);
    try {
      await createInvite(label);
      setEmail('');
      reload();
      reloadSeats();
      showToast('הזמנה נוצרה', 'success');
    } catch (e) {
      if (e instanceof Error && e.message === 'seat_limit') {
        showToast('הגעתם לתקרת המושבים — אי אפשר ליצור הזמנה חדשה', 'error');
        reloadSeats();
      } else {
        showToast('יצירת ההזמנה נכשלה', 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = () => createWith(email || undefined);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      showToast('הקישור הועתק', 'success');
    } catch {
      showToast('ההעתקה נכשלה', 'error');
    }
  };

  // Copy only the short code (for dictating in person / typing on /my-coach).
  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      showToast('הקוד הועתק', 'success');
    } catch {
      showToast('ההעתקה נכשלה', 'error');
    }
  };

  // Native share sheet (already used elsewhere in the app); falls back to copy.
  const share = async (code: string) => {
    const url = inviteLink(code);
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: 'הזמנה לאימון',
          text: 'הצטרפו אליי כמתאמנים באפליקציה',
          url,
        });
        return;
      } catch {
        // User cancelled or share unavailable — fall through to clipboard.
      }
    }
    await copy(code);
  };

  const confirmRevoke = async () => {
    if (!revokeId) return;
    const { error: revokeError } = await revokeInvite(revokeId);
    setRevokeId(null);
    if (revokeError) {
      showToast('ביטול ההזמנה נכשל', 'error');
      return;
    }
    reload();
    showToast('ההזמנה בוטלה', 'success');
  };

  // Hide the seat subtitle until the real limit resolves (avoid a '0/0' flash);
  // wrap the count in an LTR bdi so the slash/number group can't reorder in RTL.
  const seatSubtitle =
    seats.limit > 0 ? (
      <>
        <bdi dir="ltr">
          {seats.used}/{seats.limit}
        </bdi>{' '}
        מושבים
      </>
    ) : undefined;

  return (
    <CoachPage title="הזמנות" subtitle={seatSubtitle}>
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
            הגעתם לתקרת המושבים (5 מתאמנים במסלול החינמי). נסו להגדיל את התקרה בעתיד כשמסלולים
            בתשלום יהיו זמינים, או פנו לתמיכה.
          </p>
        )}
        <div className="mb-2">
          <Input
            label="שם או תזכורת (אופציונלי)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="למשל: דני מהבוקר"
            aria-label="שם או תזכורת למתאמן"
            disabled={seats.full}
          />
        </div>
        <Button
          variant="primary"
          fullWidth
          isLoading={busy}
          disabled={seats.full}
          onClick={handleCreate}
        >
          צור קוד הזמנה
        </Button>
      </Section>

      <Section title="הזמנות פתוחות">
        {loading ? (
          <ListSkeleton rows={3} />
        ) : error ? (
          <SectionError onRetry={reload} />
        ) : invites.length === 0 ? (
          <EmptyState
            illustration="generic"
            title="אין הזמנות עדיין"
            description="צור קוד הזמנה כדי לחבר מתאמן חדש."
          />
        ) : (
          sorted.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center gap-3 px-4 py-3 mb-2"
              style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-surface-2)' }}
            >
              <div className="flex-1 min-w-0">
                <button
                  type="button"
                  dir="ltr"
                  onClick={() => copyCode(inv.code)}
                  aria-label={`העתק קוד ${inv.code}`}
                  className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    color: 'var(--fs-heading)',
                    textAlign: 'start',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                  }}
                >
                  {inv.code}
                </button>
                <div
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fs-muted)' }}
                >
                  {inv.email ?? 'קוד משותף'} · {INVITE_STATUS_LABEL[inv.status] ?? inv.status} ·
                  תוקף {formatDate(inv.expiresAt)}
                </div>
              </div>
              {inv.status === 'pending' ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="הצגת קוד QR"
                    onClick={() => setQrInvite(inv)}
                    className="shrink-0"
                  >
                    <QrCode size={16} aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="שתף הזמנה"
                    onClick={() => share(inv.code)}
                    className="shrink-0"
                  >
                    <Share2 size={16} aria-hidden="true" />
                  </Button>
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
              ) : (
                // Expired/revoked/accepted rows are re-creatable in one tap —
                // a fresh code with the same label (disabled when seats are full).
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="צור הזמנה חדשה מהזמנה זו"
                  disabled={seats.full || busy}
                  onClick={() => void createWith(inv.email ?? undefined)}
                  className="shrink-0"
                >
                  <RotateCcw size={16} aria-hidden="true" />
                </Button>
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

      {/* QR sheet — in-person onboarding: the trainee scans the invite link. */}
      <Sheet
        isOpen={qrInvite !== null}
        onClose={() => setQrInvite(null)}
        title="סריקת הזמנה"
        footer={
          qrInvite && (
            <Button variant="primary" fullWidth onClick={() => copy(qrInvite.code)}>
              העתקת הקישור
            </Button>
          )
        }
      >
        {qrInvite && (
          <div className="flex flex-col items-center gap-4 py-2">
            {/* Fixed black-on-white, NOT theme tokens: QR scanners need maximal
                contrast and a light quiet zone in both light and dark modes. */}
            <div
              role="img"
              aria-label={`קוד QR להזמנה ${qrInvite.code}`}
              style={{ background: '#ffffff', padding: 16, lineHeight: 0 }}
            >
              <QRCodeSVG
                value={inviteLink(qrInvite.code)}
                size={208}
                bgColor="#ffffff"
                fgColor="#0d1516"
                level="M"
                aria-hidden="true"
              />
            </div>
            <div
              dir="ltr"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'var(--fs-heading)',
              }}
            >
              {qrInvite.code}
            </div>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'var(--fs-muted)',
                textAlign: 'center',
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              המתאמן סורק את הקוד עם המצלמה ומגיע ישירות למסך ההצטרפות.
            </p>
          </div>
        )}
      </Sheet>
    </CoachPage>
  );
}
