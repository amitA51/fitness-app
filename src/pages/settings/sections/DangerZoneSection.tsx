import { SettingsCard } from '../../../components/ui/SettingsCard';

interface Props {
  confirmDelete: boolean;
  setConfirmDelete: (v: boolean) => void;
  onDeleteAll: () => void;
}

export function DangerZoneSection({ confirmDelete, setConfirmDelete, onDeleteAll }: Props) {
  return (
    <div className="mb-7">
      <p className="section-title mb-3 px-1" style={{ color: 'var(--fs-warn)' }}>
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
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              style={{
                width: '100%',
                minHeight: '44px',
                padding: '12px',
                borderRadius: 0,
                border: '2px solid var(--fs-warn)',
                background: 'transparent',
                color: 'var(--fs-warn)',
                fontFamily: 'var(--font-hebrew)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              מחק את כל הנתונים
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onDeleteAll}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  padding: '12px',
                  borderRadius: 0,
                  border: '2px solid var(--fs-warn)',
                  background: 'var(--fs-warn)',
                  color: 'var(--fs-ink)',
                  fontFamily: 'var(--font-hebrew)',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                אשר מחיקה
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                style={{
                  flex: 1,
                  minHeight: '44px',
                  padding: '12px',
                  borderRadius: 0,
                  border: '1px solid var(--fs-surface-2)',
                  background: 'transparent',
                  color: 'var(--fs-ink)',
                  fontFamily: 'var(--font-hebrew)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                ביטול
              </button>
            </div>
          )}
        </div>
      </SettingsCard>
    </div>
  );
}
