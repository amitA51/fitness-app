import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { SettingsCard } from '../../../components/ui/SettingsCard';

interface Props {
  onDeleteAll: () => void;
}

/**
 * Privacy danger-zone. The destructive delete keeps its deliberate two-step
 * shape — an explicit trigger button, then a confirm step — but the second step
 * is now the foundation {@link ConfirmDialog} (variant="danger") instead of the
 * old bespoke inline confirm/cancel buttons. That gives us the shared modal's
 * focus trap, Esc/backdrop dismissal, scroll lock and reduced-motion handling.
 */
export function DangerZoneSection({ onDeleteAll }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirm = () => {
    setConfirmOpen(false);
    onDeleteAll();
  };

  return (
    <div className="mb-7">
      {/* color-error, not fs-warn — the orange is 2.5:1 on the light bg */}
      <p className="section-title mb-3 px-1" style={{ color: 'var(--color-error)' }}>
        אזור מסוכן
      </p>
      <SettingsCard>
        <div className="px-4 py-4">
          <p
            style={{
              fontFamily: 'var(--font-hebrew)',
              fontSize: '14px',
              color: 'var(--fs-ink)',
              marginBottom: '12px',
            }}
          >
            מחיקת כל הנתונים תנקה את כל האימונים, ההעדפות וההגדרות. פעולה זו בלתי הפיכה.
          </p>
          <Button
            variant="danger"
            fullWidth
            shape="sharp"
            icon={<Trash2 size={16} aria-hidden="true" />}
            onClick={() => setConfirmOpen(true)}
          >
            מחק את כל הנתונים
          </Button>
        </div>
      </SettingsCard>

      <ConfirmDialog
        isOpen={confirmOpen}
        variant="danger"
        title="מחיקת כל הנתונים"
        description="כל האימונים, ההעדפות וההגדרות יימחקו לצמיתות. לא ניתן לבטל פעולה זו."
        confirmLabel="אשר מחיקה"
        cancelLabel="ביטול"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
