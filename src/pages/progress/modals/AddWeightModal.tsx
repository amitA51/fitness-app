import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { memo, useState } from 'react';

export const AddWeightModal = memo(function AddWeightModal({
  onSave,
  onClose,
}: { onSave: (weight: number, notes: string) => Promise<void>; onClose: () => void }) {
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

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
        className="w-full max-w-lg p-6"
        style={{ background: 'var(--fs-surface)', borderTop: '1px solid var(--fs-surface-2)' }}
        onClick={(e) => e.stopPropagation()}
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
            עדכון משקל
          </h2>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              background: 'var(--fs-surface-2)',
              border: 'none',
              borderRadius: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--fs-muted)',
              cursor: 'pointer',
            }}
          >
            <X size={17} />
          </button>
        </div>
        <div className="space-y-5">
          <div className="text-center py-4">
            <input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="0.0"
              style={{
                width: '144px',
                textAlign: 'center',
                background: 'transparent',
                color: 'var(--fs-ink)',
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: '48px',
                borderBottom: '2px solid var(--fs-accent)',
                outline: 'none',
              }}
              step="0.1"
              inputMode="decimal"
            />
            <div
              style={{
                fontSize: '18px',
                color: 'var(--fs-muted)',
                marginTop: '8px',
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
            style={{
              width: '100%',
              background: 'var(--fs-surface-2)',
              border: '1px solid var(--fs-surface-2)',
              borderRadius: 0,
              padding: '14px 16px',
              color: 'var(--fs-ink)',
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              outline: 'none',
            }}
          />
          <motion.button
            onClick={async () => {
              if (!weight) return;
              setSaving(true);
              await onSave(Number.parseFloat(weight), notes);
              setSaving(false);
            }}
            disabled={!weight || saving}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 0,
              background: !weight || saving ? 'var(--fs-surface-2)' : 'var(--fs-primary)',
              color: !weight || saving ? 'var(--fs-muted)' : 'var(--fs-accent)',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '16px',
              textTransform: 'uppercase',
              border: 'none',
              cursor: !weight || saving ? 'not-allowed' : 'pointer',
              opacity: !weight || saving ? 0.4 : 1,
            }}
            whileTap={{ scale: weight ? 0.98 : 1 }}
          >
            שמור
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
});
