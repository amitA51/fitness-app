// ============================================================================
// AddMeasurementModal — body-measurement entry sheet.
// ============================================================================
// Refactored onto the foundation <Sheet> (drag handle, header + 44px close,
// scroll, sticky footer, focus trap, scroll lock, Esc/backdrop dismiss). Only
// the 6-field measurement grid and the save action remain. The sheet stays
// mounted and is driven by `isOpen`; form state seeds from `latest` each open.

import { memo, useEffect, useId, useMemo, useState } from 'react';
import { Sheet } from '../../../components/ui/Sheet';
import type { BodyMeasurement } from '../../../services/bodyStatsService';
import { SaveButton } from './AddWeightModal';

export const AddMeasurementModal = memo(function AddMeasurementModal({
  isOpen,
  onSave,
  onClose,
  latest,
}: {
  isOpen: boolean;
  onSave: (m: Omit<BodyMeasurement, 'id' | 'createdAt'>) => Promise<void>;
  onClose: () => void;
  latest: BodyMeasurement | null;
}) {
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [hips, setHips] = useState('');
  const [arms, setArms] = useState('');
  const [thighs, setThighs] = useState('');
  const [neck, setNeck] = useState('');
  const [saving, setSaving] = useState(false);
  const baseId = useId();

  // Seed from the latest measurement each time the sheet opens.
  useEffect(() => {
    if (!isOpen) return;
    setChest(latest?.chest?.toString() || '');
    setWaist(latest?.waist?.toString() || '');
    setHips(latest?.hips?.toString() || '');
    setArms(latest?.arms?.toString() || '');
    setThighs(latest?.thighs?.toString() || '');
    setNeck(latest?.neck?.toString() || '');
    setSaving(false);
  }, [isOpen, latest]);

  const fields = useMemo(
    () => [
      { label: 'חזה', value: chest, setter: setChest },
      { label: 'מותניים', value: waist, setter: setWaist },
      { label: 'אגן', value: hips, setter: setHips },
      { label: 'זרועות', value: arms, setter: setArms },
      { label: 'ירכיים', value: thighs, setter: setThighs },
      { label: 'צוואר', value: neck, setter: setNeck },
    ],
    [chest, waist, hips, arms, thighs, neck]
  );

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const num = (v: string) => (v ? Number.parseFloat(v) : undefined);
      await onSave({
        date: new Date().toISOString().slice(0, 10),
        chest: num(chest),
        waist: num(waist),
        hips: num(hips),
        arms: num(arms),
        thighs: num(thighs),
        neck: num(neck),
        notes: '',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="עדכון מידות"
      footer={
        <SaveButton onClick={handleSave} disabled={saving} saving={saving} label="שמור מידות" />
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.label}>
            <label
              htmlFor={`${baseId}-${f.label}`}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 11,
                color: 'var(--fs-muted)',
                marginBottom: 6,
                display: 'block',
                fontWeight: 500,
              }}
            >
              {f.label} (ס״מ)
            </label>
            <input
              id={`${baseId}-${f.label}`}
              type="number"
              value={f.value}
              onChange={(e) => f.setter(e.target.value)}
              placeholder="—"
              style={{
                width: '100%',
                background: 'var(--fs-surface-2)',
                border: '1px solid var(--fs-surface-2)',
                borderRadius: 0,
                padding: '12px 16px',
                color: 'var(--fs-ink)',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                outline: 'none',
                textAlign: 'center',
                direction: 'ltr',
              }}
              step="0.1"
              inputMode="decimal"
            />
          </div>
        ))}
      </div>
    </Sheet>
  );
});

export default AddMeasurementModal;
