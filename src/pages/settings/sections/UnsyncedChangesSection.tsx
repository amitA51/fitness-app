// ============================================================================
// UnsyncedChangesSection — recovery UI for the offline queue's dead letters
// ============================================================================
// The offline queue used to DELETE a mutation after five failed attempts, so a
// change that could not reach the cloud was destroyed silently. It now keeps the
// payload in a dead-letter store, and the failure toast tells the user they can
// retry "from Settings" — this is that place.
//
// The section renders nothing when there is nothing held, so it never adds noise
// to a healthy account.
// ============================================================================

import { AlertTriangle, Download, RefreshCw, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { showToast } from '../../../components/ui/GlobalToast';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import {
  type DeadLetterMutation,
  exportDeadLetters,
  listDeadLetters,
  retryAllDeadLetters,
} from '../../../services/offlineQueue';
import { logger } from '../../../utils/logger';

/** Hebrew label per mutation family, so the list is readable to a non-developer. */
function describeMutation(type: string): string {
  const [entity] = type.split(':');
  switch (entity) {
    case 'session':
      return 'אימון';
    case 'template':
      return 'תבנית אימון';
    case 'exercise':
      return 'תרגיל אישי';
    case 'bodyweight':
      return 'שקילה';
    case 'measurement':
      return 'מדידת גוף';
    case 'record':
      return 'שיא אישי';
    case 'recovery':
      return 'דיווח התאוששות';
    case 'nutrition':
      return 'רישום תזונה';
    case 'water':
      return 'רישום שתייה';
    case 'setting':
      return 'הגדרה';
    case 'ai':
      return 'שיחה עם המאמן החכם';
    default:
      return 'שינוי';
  }
}

export function UnsyncedChangesSection() {
  const [held, setHeld] = useState<DeadLetterMutation[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmDiscardAll, setConfirmDiscardAll] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setHeld(await listDeadLetters());
    } catch (err) {
      logger.sync.warn('Could not read held changes', err);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRetry = async () => {
    setBusy(true);
    try {
      const requeued = await retryAllDeadLetters();
      await refresh();
      const remaining = await listDeadLetters();
      if (remaining.length === 0 && requeued > 0) {
        showToast('כל השינויים נשמרו בענן', 'success');
      } else if (remaining.length > 0) {
        showToast('חלק מהשינויים עדיין לא נשמרו. נסו שוב כשיש חיבור טוב יותר', 'error');
      }
    } catch (err) {
      logger.sync.error('Retrying held changes failed', err);
      showToast('הניסיון נכשל. בדקו את החיבור ונסו שוב', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    try {
      const json = await exportDeadLetters();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sparkos-unsynced-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      logger.sync.error('Exporting held changes failed', err);
      showToast('הייצוא נכשל. נסו שוב', 'error');
    }
  };

  const handleDiscardAll = async () => {
    setConfirmDiscardAll(false);
    setBusy(true);
    try {
      const { discardDeadLetter } = await import('../../../services/offlineQueue');
      for (const entry of held) {
        await discardDeadLetter(entry.id);
      }
      await refresh();
      showToast('השינויים נמחקו מהמכשיר', 'success');
    } catch (err) {
      logger.sync.error('Discarding held changes failed', err);
      showToast('המחיקה נכשלה. נסו שוב', 'error');
    } finally {
      setBusy(false);
    }
  };

  // Healthy account: stay out of the way entirely.
  if (held.length === 0) return null;

  // Two different situations end up in this store, and they need different words:
  // a change that FAILED to sync (retry it), and a change made with no signed-in
  // account (claim it for this account). Mixing them would either accuse the app
  // of losing data or hide the fact that a decision is required.
  const ownerless = held.filter((entry) => entry.reason === 'ownerless');
  const allOwnerless = ownerless.length === held.length;
  const primaryLabel = allOwnerless ? 'אשרו ושמרו בענן' : 'נסו לשלוח שוב';

  return (
    <div className="mb-7">
      <SectionLabel tone="danger">
        {allOwnerless ? 'שינויים שנוצרו ללא חשבון מחובר' : 'שינויים שלא נשמרו בענן'}
      </SectionLabel>
      <SettingsCard>
        <div className="px-4 py-4">
          <div className="flex items-start gap-2 mb-3">
            <AlertTriangle
              size={16}
              style={{ color: 'var(--fs-warn)', flexShrink: 0, marginTop: 2 }}
              aria-hidden="true"
            />
            <p
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: '14px',
                color: 'var(--fs-ink)',
                margin: 0,
              }}
            >
              {allOwnerless ? (
                <>
                  {held.length === 1
                    ? 'שינוי אחד נשמר במכשיר לפני שהתחברתם לחשבון.'
                    : `${held.length} שינויים נשמרו במכשיר לפני שהתחברתם לחשבון.`}{' '}
                  לא נשמור אותם בענן בלי אישור, כדי שלא ישויכו לחשבון הלא נכון.
                </>
              ) : (
                <>
                  {held.length === 1
                    ? 'שינוי אחד נשמר במכשיר אך לא הגיע לענן.'
                    : `${held.length} שינויים נשמרו במכשיר אך לא הגיעו לענן.`}{' '}
                  אפשר לנסות לשלוח אותם שוב, או לייצא אותם לקובץ לפני מחיקה.
                </>
              )}
            </p>
          </div>

          <ul style={{ listStyle: 'none', margin: '0 0 12px', padding: 0 }}>
            {held.slice(0, 5).map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-3 py-1.5"
                style={{
                  fontFamily: 'var(--font-hebrew)',
                  fontSize: '13px',
                  color: 'var(--fs-muted)',
                }}
              >
                <span style={{ color: 'var(--fs-ink)' }}>{describeMutation(entry.type)}</span>
                <span dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                  {new Date(entry.failedAt).toLocaleDateString('he-IL')}
                </span>
              </li>
            ))}
            {held.length > 5 && (
              <li
                style={{
                  fontFamily: 'var(--font-hebrew)',
                  fontSize: '12px',
                  color: 'var(--fs-muted)',
                  paddingTop: 4,
                }}
              >
                ועוד {held.length - 5}
              </li>
            )}
          </ul>

          <div className="flex flex-col gap-2">
            <Button
              variant="primary"
              fullWidth
              disabled={busy}
              icon={<RefreshCw size={16} aria-hidden="true" />}
              onClick={() => void handleRetry()}
            >
              {primaryLabel}
            </Button>
            <Button
              variant="ghost"
              fullWidth
              disabled={busy}
              icon={<Download size={16} aria-hidden="true" />}
              onClick={() => void handleExport()}
            >
              ייצוא לקובץ
            </Button>
            <Button
              variant="ghost"
              fullWidth
              disabled={busy}
              icon={<Trash2 size={16} aria-hidden="true" />}
              onClick={() => setConfirmDiscardAll(true)}
            >
              מחיקת השינויים
            </Button>
          </div>
        </div>
      </SettingsCard>

      <ConfirmDialog
        isOpen={confirmDiscardAll}
        variant="danger"
        title="מחיקת השינויים שלא נשמרו"
        description="השינויים יימחקו מהמכשיר ולא יישלחו לענן. מומלץ לייצא אותם לקובץ קודם. לא ניתן לבטל פעולה זו."
        confirmLabel="מחקו"
        cancelLabel="ביטול"
        onConfirm={() => void handleDiscardAll()}
        onCancel={() => setConfirmDiscardAll(false)}
      />
    </div>
  );
}
