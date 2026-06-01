// ============================================================================
// AddWeightModal — body-weight entry sheet.
// ============================================================================
// Refactored onto the foundation <Sheet>: the drag handle, header (title + 44px
// close), scrollable body, sticky footer, focus trap, scroll lock, Esc-to-close
// and backdrop-dismiss all come from Sheet/ModalOverlay. Only the form body and
// the save action remain here. The sheet stays mounted and is driven by
// `isOpen`; form state resets each time it opens.

import { memo, useEffect, useState } from 'react';
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

  // Fresh form on every open (parity with the former mount-on-open behavior).
  useEffect(() => {
    if (isOpen) {
      setWeight('');
      setNotes('');
      setSaving(false);
    }
  }, [isOpen]);

  const canSave = !!weight && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave(Number.parseFloat(weight), notes);
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
          <input
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
              fontWeight: 900,
              fontSize: 48,
              borderBottom: '2px solid var(--fs-accent)',
              outline: 'none',
              direction: 'ltr',
            }}
            step="0.1"
            inputMode="decimal"
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
            borderRadius: 0,
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
      style={{
        width: '100%',
        padding: 16,
        minHeight: 44,
        borderRadius: 0,
        background: disabled ? 'var(--fs-surface-2)' : 'var(--fs-primary)',
        color: disabled ? 'var(--fs-muted)' : 'var(--fs-accent)',
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 16,
        textTransform: 'uppercase',
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
