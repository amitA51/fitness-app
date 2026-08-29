import { AlertCircle, Trash2, UserX } from 'lucide-react';
import { useState } from 'react';
import { AnnualInput } from '../../../components/ui/AnnualInput';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import { useAuth } from '../../../contexts/AuthContext';
import { deleteAccount, deleteAccountErrorMessage } from '../../../services/accountService';

interface Props {
  onDeleteAll: () => void;
}

/**
 * Privacy danger-zone. Two deliberately DIFFERENT destructive actions:
 *
 * 1. "מחיקת נתוני האימון" — what the old single button actually did: clears the
 *    device and the synced training tables, but keeps the account. The copy now
 *    says exactly that instead of promising permanent, total erasure.
 * 2. "מחיקת החשבון" — the real erasure path (services/accountService), gated by
 *    typing the account email. The server re-verifies that email against the
 *    caller's JWT before it deletes Storage objects and the auth.users row.
 *
 * Both keep the two-step shape (trigger, then {@link ConfirmDialog}) so the
 * shared modal's focus trap, Esc/backdrop dismissal and scroll lock apply.
 */
export function DangerZoneSection({ onDeleteAll }: Props) {
  const { user } = useAuth();
  const [confirmDataOpen, setConfirmDataOpen] = useState(false);
  const [confirmAccountOpen, setConfirmAccountOpen] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  const accountEmail = user?.email ?? '';
  const canDeleteAccount = accountEmail.length > 0;
  const emailMatches =
    canDeleteAccount && emailInput.trim().toLowerCase() === accountEmail.toLowerCase();

  const handleConfirmData = () => {
    setConfirmDataOpen(false);
    onDeleteAll();
  };

  const handleConfirmAccount = async () => {
    setAccountError(null);
    setDeleting(true);
    const res = await deleteAccount(emailInput);
    setDeleting(false);

    if (!res.ok) {
      setAccountError(deleteAccountErrorMessage(res.error));
      return;
    }

    setConfirmAccountOpen(false);
    // The account no longer exists and the local mirror was wiped; a full reload
    // is the only honest way to drop every in-memory context.
    window.location.assign('/');
  };

  return (
    <div className="mb-5">
      <SectionLabel tone="danger">אזור מסוכן</SectionLabel>

      {/* ── 1. Training data only ── */}
      <SettingsCard>
        <div className="px-4 py-4">
          <p
            style={{
              fontFamily: 'var(--font-hebrew)',
              fontSize: '14px',
              color: 'var(--fs-ink)',
              marginBottom: '6px',
            }}
          >
            מחיקת נתוני האימון תסיר מהמכשיר ומהענן את האימונים, התבניות, מדידות הגוף, התזונה
            וההעדפות. פעולה זו אינה הפיכה.
          </p>
          <p
            style={{
              fontFamily: 'var(--font-hebrew)',
              fontSize: '13px',
              color: 'var(--fs-muted)',
              marginBottom: '12px',
            }}
          >
            החשבון עצמו נשאר פעיל, ואפשר להתחיל מחדש מאותה כתובת דוא"ל.
          </p>
          <Button
            variant="danger"
            fullWidth
            shape="sharp"
            icon={<Trash2 size={16} aria-hidden="true" />}
            onClick={() => setConfirmDataOpen(true)}
          >
            מחיקת נתוני האימון
          </Button>
        </div>
      </SettingsCard>

      {/* ── 2. Full account erasure ── */}
      <div className="mt-3">
        <SettingsCard>
          <div className="px-4 py-4">
            <p
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: '14px',
                color: 'var(--fs-ink)',
                marginBottom: '6px',
              }}
            >
              מחיקת החשבון תמחק לצמיתות את כל המידע: נתוני אימון, תמונות התקדמות, הקשר עם המאמן,
              ההודעות, ההסכמות והחשבון עצמו.
            </p>
            <p
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: '13px',
                color: 'var(--fs-muted)',
                marginBottom: '12px',
              }}
            >
              {canDeleteAccount
                ? 'לאישור, הקלידו את כתובת הדוא"ל של החשבון. מומלץ לייצא את הנתונים לפני המחיקה.'
                : 'מחיקת חשבון זמינה רק לחשבון מחובר לענן. במצב אורח אפשר למחוק את נתוני האימון מהמכשיר.'}
            </p>

            {canDeleteAccount && (
              <>
                <div className="mb-3">
                  <AnnualInput
                    label={'כתובת הדוא"ל של החשבון'}
                    type="email"
                    inputMode="email"
                    value={emailInput}
                    onChange={(val) => {
                      setEmailInput(val);
                      setAccountError(null);
                    }}
                    placeholder={accountEmail}
                    autoComplete="off"
                  />
                </div>

                {accountError && !confirmAccountOpen && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 mb-3"
                    style={{
                      background: 'var(--color-error-muted)',
                      border: '1px solid var(--color-error)',
                      borderRadius: 12,
                      padding: '10px 12px',
                    }}
                  >
                    <AlertCircle
                      size={15}
                      style={{ color: 'var(--color-error)', flexShrink: 0, marginTop: 2 }}
                      aria-hidden="true"
                    />
                    <p
                      style={{
                        fontFamily: 'var(--font-hebrew)',
                        fontSize: '13px',
                        color: 'var(--color-error)',
                        margin: 0,
                      }}
                    >
                      {accountError}
                    </p>
                  </div>
                )}

                <Button
                  variant="danger"
                  fullWidth
                  shape="sharp"
                  disabled={!emailMatches || deleting}
                  icon={<UserX size={16} aria-hidden="true" />}
                  onClick={() => setConfirmAccountOpen(true)}
                >
                  מחיקת החשבון לצמיתות
                </Button>
              </>
            )}
          </div>
        </SettingsCard>
      </div>

      <ConfirmDialog
        isOpen={confirmDataOpen}
        variant="danger"
        title="מחיקת נתוני האימון"
        description="האימונים, התבניות, המדידות, התזונה וההעדפות יימחקו מהמכשיר ומהענן. החשבון יישאר פעיל. לא ניתן לבטל פעולה זו."
        confirmLabel="אשרו מחיקה"
        cancelLabel="ביטול"
        onConfirm={handleConfirmData}
        onCancel={() => setConfirmDataOpen(false)}
      />

      <ConfirmDialog
        isOpen={confirmAccountOpen}
        variant="danger"
        title="מחיקת החשבון לצמיתות"
        description="כל המידע והחשבון עצמו יימחקו ולא ניתן לשחזר אותם. אם יש מנוי פעיל, בטלו אותו לפני המחיקה."
        confirmLabel="מחקו את החשבון"
        cancelLabel="ביטול"
        isPending={deleting}
        pendingLabel="מוחקים את החשבון..."
        errorMessage={accountError ?? undefined}
        onConfirm={() => void handleConfirmAccount()}
        onCancel={() => {
          if (deleting) return;
          setConfirmAccountOpen(false);
        }}
      />
    </div>
  );
}
