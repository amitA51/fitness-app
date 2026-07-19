// ============================================================================
// AddWeightModal — body-weight entry sheet.
// ============================================================================
// Refactored onto the foundation <Sheet>: the drag handle, header (title + 44px
// close), scrollable body, sticky footer, focus trap, scroll lock, Esc-to-close
// and backdrop-dismiss all come from Sheet/ModalOverlay. Only the form body and
// the save action remain here. The sheet stays mounted and is driven by
// `isOpen`; form state resets each time it opens.

import { memo, useEffect, useId, useState } from 'react';
import { Sheet } from '../../../components/ui/Sheet';

export const AddWeightModal = memo(function AddWeightModal({
  isOpen,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  onSave: (weight: number, notes: string) => Promise<void>;
  onClose: () => void;
}) {
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const weightId = useId();

  // Fresh form on every open (parity with the former mount-on-open behavior).
  useEffect(() => {
    if (isOpen) {
      setWeight('');
      setNotes('');
      setSaving(false);
      setError(null);
    }
  }, [isOpen]);

  // Mirror bodyStatsService validation (0 < weight < 700) so invalid input
  // (e.g. "-5") disables the CTA instead of throwing at save time.
  const parsedWeight = Number.parseFloat(weight);
  const isValidWeight = Number.isFinite(parsedWeight) && parsedWeight > 0 && parsedWeight < 700;
  const canSave = !!weight && isValidWeight && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(parsedWeight, notes);
    } catch {
      // Inline, below the input — the sheet stays open so the value isn't lost.
      setError('שמירת המשקל נכשלה. נסו שוב.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="עדכון משקל"
      footer={<SaveButton onClick={handleSave} disabled={!canSave} saving={saving} label="שמור" />}
    >
      <div className="space-y-5">
        <div className="text-center py-4">
          <label
            htmlFor={weightId}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--fs-muted)',
              marginBottom: 12,
              display: 'block',
              fontWeight: 500,
            }}
          >
            משקל
          </label>
          <input
            id={weightId}
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="0.0"
            aria-label="משקל בק״ג"
            style={{
              width: 144,
              textAlign: 'center',
              background: 'transparent',
              color: 'var(--fs-ink)',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 48,
              borderBottom: '2px solid var(--fs-accent)',
              outline: 'none',
              direction: 'ltr',
            }}
            step="0.1"
            inputMode="decimal"
            enterKeyHint="done"
          />
          <div
            style={{
              fontSize: 18,
              color: 'var(--fs-muted)',
              marginTop: 8,
              fontWeight: 500,
              fontFamily: 'var(--font-body)',
            }}
          >
            ק״ג
          </div>
          {!!weight && !isValidWeight && (
            <p
              role="alert"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'var(--color-error)',
                marginTop: 8,
              }}
            >
              יש להזין משקל בין 0 ל-700 ק״ג
            </p>
          )}
          {error && (
            <p
              role="alert"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'var(--color-error)',
                marginTop: 8,
              }}
            >
              {error}
            </p>
          )}
        </div>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="הערות (אופציונלי)"
          aria-label="הערות"
          style={{
            width: '100%',
            background: 'var(--fs-surface-2)',
            border: '1px solid var(--fs-surface-2)',
            borderRadius: 12,
            padding: '14px 16px',
            color: 'var(--fs-ink)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            outline: 'none',
          }}
        />
      </div>
    </Sheet>
  );
});

/** Shared sharp primary save action used by the three Add* sheets. */
export function SaveButton({
  onClick,
  disabled,
  saving,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  saving: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="transition-transform active:scale-[0.98] motion-reduce:active:scale-100 disabled:active:scale-100"
      style={{
        width: '100%',
        padding: 16,
        minHeight: 44,
        borderRadius: 12,
        background: disabled ? 'var(--fs-surface-2)' : 'var(--fs-primary)',
        color: disabled ? 'var(--fs-muted)' : 'var(--fs-accent)',
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        fontSize: 16,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {saving ? '...שומר' : label}
    </button>
  );
}

export default AddWeightModal;
