import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { memo, useId, useMemo, useState } from 'react';
import type { BodyMeasurement } from '../../../services/bodyStatsService';

export const AddMeasurementModal = memo(function AddMeasurementModal({
  onSave,
  onClose,
  latest,
}: {
  onSave: (m: Omit<BodyMeasurement, 'id' | 'createdAt'>) => Promise<void>;
  onClose: () => void;
  latest: BodyMeasurement | null;
}) {
  const [chest, setChest] = useState(latest?.chest?.toString() || '');
  const [waist, setWaist] = useState(latest?.waist?.toString() || '');
  const [hips, setHips] = useState(latest?.hips?.toString() || '');
  const [arms, setArms] = useState(latest?.arms?.toString() || '');
  const [thighs, setThighs] = useState(latest?.thighs?.toString() || '');
  const [neck, setNeck] = useState(latest?.neck?.toString() || '');
  const [saving, setSaving] = useState(false);
  const baseId = useId();

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-lg p-6 max-h-[82vh] overflow-y-auto"
        style={{ background: 'var(--fs-surface)', borderTop: '1px solid var(--fs-surface-2)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="עדכון מידות"
      >
        <div className="flex justify-center mb-4">
          <div
            style={{
              width: '40px',
              height: '4px',
              background: 'var(--fs-surface-2)',
              borderRadius: 0,
            }}
          />
        </div>
        <div className="flex items-center justify-between mb-6">
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '18px',
              color: 'var(--fs-ink)',
              textTransform: 'uppercase',
            }}
          >
            עדכון מידות
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '44px',
              height: '44px',
              background: 'var(--fs-surface-2)',
              border: 'none',
              borderRadius: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--fs-muted)',
              cursor: 'pointer',
            }}
            aria-label="סגור"
          >
            <X size={17} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => (
            <div key={f.label}>
              <label
                htmlFor={`${baseId}-${f.label}`}
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '11px',
                  color: 'var(--fs-muted)',
                  marginBottom: '6px',
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
                  fontSize: '14px',
                  outline: 'none',
                  textAlign: 'center',
                }}
                step="0.1"
                inputMode="decimal"
              />
            </div>
          ))}
        </div>
        <motion.button
          onClick={async () => {
            if (saving) return;
            setSaving(true);
            try {
              await onSave({
                date: new Date().toISOString().slice(0, 10),
                chest: chest ? Number.parseFloat(chest) : undefined,
                waist: waist ? Number.parseFloat(waist) : undefined,
                hips: hips ? Number.parseFloat(hips) : undefined,
                arms: arms ? Number.parseFloat(arms) : undefined,
                thighs: thighs ? Number.parseFloat(thighs) : undefined,
                neck: neck ? Number.parseFloat(neck) : undefined,
                notes: '',
              });
            } finally {
              setSaving(false);
            }
          }}
          disabled={saving}
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: 0,
            background: saving ? 'var(--fs-surface-2)' : 'var(--fs-primary)',
            color: saving ? 'var(--fs-muted)' : 'var(--fs-accent)',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: '16px',
            textTransform: 'uppercase',
            border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.4 : 1,
            marginTop: '20px',
          }}
          whileTap={{ scale: saving ? 1 : 0.98 }}
        >
          שמור מידות
        </motion.button>
      </motion.div>
    </motion.div>
  );
});
