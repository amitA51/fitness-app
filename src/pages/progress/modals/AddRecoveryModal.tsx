// ============================================================================
// AddRecoveryModal — daily recovery-report sheet.
// ============================================================================
// Refactored onto the foundation <Sheet> (drag handle, header + 44px close,
// scroll, sticky footer, focus trap, scroll lock, Esc/backdrop dismiss). Only
// the slider inputs, tight-areas picker, notes field, and save action remain.
// The sheet stays mounted and is driven by `isOpen`; form state resets on open.

import { memo, useEffect, useState } from 'react';
import { Sheet } from '../../../components/ui/Sheet';
import { TIGHTNESS_AREAS } from '../../../services/bodyStatsService';
import type { RecoveryLog } from '../../../services/bodyStatsService';
import { SliderInput } from '../components/SliderInput';
import { SaveButton } from './AddWeightModal';

type Rating = 1 | 2 | 3 | 4 | 5;

export const AddRecoveryModal = memo(function AddRecoveryModal({
  isOpen,
  onSave,
  onClose,
}: {
  isOpen: boolean;
  onSave: (r: Omit<RecoveryLog, 'id' | 'createdAt'>) => Promise<void>;
  onClose: () => void;
}) {
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState<Rating>(3);
  const [sorenessLevel, setSorenessLevel] = useState<Rating>(3);
  const [energyLevel, setEnergyLevel] = useState<Rating>(3);
  const [stressLevel, setStressLevel] = useState<Rating>(3);
  const [tightAreas, setTightAreas] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Fresh report on every open.
  useEffect(() => {
    if (!isOpen) return;
    setSleepHours(7);
    setSleepQuality(3);
    setSorenessLevel(3);
    setEnergyLevel(3);
    setStressLevel(3);
    setTightAreas([]);
    setNotes('');
    setSaving(false);
  }, [isOpen]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
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
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="דיווח ריקאברי"
      footer={<SaveButton onClick={handleSave} disabled={saving} saving={saving} label="שמור" />}
    >
      <div className="space-y-6">
        <SliderInput
          label="שעות שינה"
          value={sleepHours}
          onChange={setSleepHours}
          min={0}
          max={12}
          step={0.5}
          unit=" ש'"
          color="var(--fs-accent)"
        />
        <SliderInput
          label="איכות שינה"
          value={sleepQuality}
          onChange={(v) => setSleepQuality(v as Rating)}
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
          onChange={(v) => setSorenessLevel(v as Rating)}
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
          onChange={(v) => setEnergyLevel(v as Rating)}
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
          onChange={(v) => setStressLevel(v as Rating)}
          min={1}
          max={5}
          step={1}
          unit=""
          color="var(--fs-accent)"
          labels={['מלחיץ מאוד', 'מלחיץ', 'בסדר', 'רגוע', 'רגוע לחלוטין']}
        />

        <div>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--fs-muted)',
              marginBottom: 12,
              display: 'block',
              fontWeight: 500,
            }}
          >
            אזורים תפוסים
          </span>
          <div className="flex flex-wrap gap-2">
            {TIGHTNESS_AREAS.map((area) => {
              const active = tightAreas.includes(area);
              return (
                <button
                  type="button"
                  key={area}
                  aria-pressed={active}
                  onClick={() =>
                    setTightAreas((prev) =>
                      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
                    )
                  }
                  style={{
                    padding: '8px 14px',
                    minHeight: 44,
                    borderRadius: 0,
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'var(--font-display)',
                    textTransform: 'uppercase',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: active ? 'var(--fs-primary)' : 'var(--fs-surface-2)',
                    color: active ? 'var(--fs-accent)' : 'var(--fs-muted)',
                  }}
                >
                  {area}
                </button>
              );
            })}
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

export default AddRecoveryModal;
