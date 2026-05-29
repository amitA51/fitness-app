import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { memo, useState } from 'react';
import { TIGHTNESS_AREAS } from '../../../services/bodyStatsService';
import type { RecoveryLog } from '../../../services/bodyStatsService';
import { SliderInput } from '../components/SliderInput';

export const AddRecoveryModal = memo(function AddRecoveryModal({
  onSave,
  onClose,
}: { onSave: (r: Omit<RecoveryLog, 'id' | 'createdAt'>) => Promise<void>; onClose: () => void }) {
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [sorenessLevel, setSorenessLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [energyLevel, setEnergyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [stressLevel, setStressLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [tightAreas, setTightAreas] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

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
        className="w-full max-w-lg p-6 max-h-[88vh] overflow-y-auto"
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
            דיווח ריקאברי
          </h2>
          <button
            type="button"
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
        <div className="space-y-6">
          <SliderInput
            label="שעות שינה"
            value={sleepHours}
            onChange={setSleepHours}
            min={0}
            max={12}
            step={0.5}
            unit=" ש"
            color="var(--fs-accent)"
          />
          <SliderInput
            label="איכות שינה"
            value={sleepQuality}
            onChange={(v) => setSleepQuality(v as 1 | 2 | 3 | 4 | 5)}
            min={1}
            max={5}
            step={1}
            unit=""
            color="var(--fs-accent)"
            labels={['גרוע', 'עלוב', 'בסדר', 'טוב', 'מעולה']}
          />
          <SliderInput
            label="רמת כאב"
            value={sorenessLevel}
            onChange={(v) => setSorenessLevel(v as 1 | 2 | 3 | 4 | 5)}
            min={1}
            max={5}
            step={1}
            unit=""
            color="var(--fs-warn)"
            labels={['כואב מאוד', 'כואב', 'בסדר', 'טוב', 'רענן']}
          />
          <SliderInput
            label="רמת אנרגיה"
            value={energyLevel}
            onChange={(v) => setEnergyLevel(v as 1 | 2 | 3 | 4 | 5)}
            min={1}
            max={5}
            step={1}
            unit=""
            color="var(--fs-signal)"
            labels={['מותש', 'נמוכה', 'בסדר', 'טובה', 'מלא אנרגיה']}
          />
          <SliderInput
            label="רמת לחץ"
            value={stressLevel}
            onChange={(v) => setStressLevel(v as 1 | 2 | 3 | 4 | 5)}
            min={1}
            max={5}
            step={1}
            unit=""
            color="var(--fs-accent)"
            labels={['מלחיץ מאוד', 'מלחיץ', 'בסדר', 'רגוע', 'רגוע לחלוטין']}
          />

          <div>
            <label
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--fs-muted)',
                marginBottom: '12px',
                display: 'block',
                fontWeight: 500,
              }}
            >
              אזורים תפוסים
            </label>
            <div className="flex flex-wrap gap-2">
              {TIGHTNESS_AREAS.map((area) => (
                <button
                  type="button"
                  key={area}
                  onClick={() =>
                    setTightAreas((prev) =>
                      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
                    )
                  }
                  style={{
                    padding: '8px 14px',
                    borderRadius: 0,
                    fontSize: '12px',
                    fontWeight: 600,
                    fontFamily: 'var(--font-display)',
                    textTransform: 'uppercase',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: tightAreas.includes(area)
                      ? 'var(--fs-primary)'
                      : 'var(--fs-surface-2)',
                    color: tightAreas.includes(area) ? 'var(--fs-accent)' : 'var(--fs-muted)',
                  }}
                >
                  {area}
                </button>
              ))}
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
              await onSave({
                date: new Date().toISOString().slice(0, 10),
                sleepHours,
                sleepQuality,
                sorenessLevel,
                energyLevel,
                stressLevel,
                tightAreas,
                notes,
              });
            }}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 0,
              background: 'var(--fs-primary)',
              color: 'var(--fs-accent)',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '16px',
              textTransform: 'uppercase',
              border: 'none',
              cursor: 'pointer',
            }}
            whileTap={{ scale: 0.98 }}
          >
            שמור
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
});
