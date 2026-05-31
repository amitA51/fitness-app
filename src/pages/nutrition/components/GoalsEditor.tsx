import { motion } from 'framer-motion';
import { Lock, X, Zap } from 'lucide-react';
import { memo, useState } from 'react';
import { computeMacrosFromProfile } from '../../../services/settingsService';
import type { MacroNutrients } from '../../../types';
import { safeJsonParse } from '../../../utils/safeJson';

interface GoalsEditorProps {
  goals: MacroNutrients;
  /** When true the goals are coach-assigned and editing is disabled. */
  coachTarget: boolean;
  onSave: (goals: MacroNutrients) => boolean;
  onClose: () => void;
}

interface StoredProfile {
  weight?: number;
  height?: number | '';
  age?: number | '';
  gender?: 'male' | 'female' | 'other';
  activityLevel?: string;
  weightGoal?: string;
}

const FIELDS: {
  key: keyof Pick<MacroNutrients, 'calories' | 'protein' | 'carbs' | 'fat'>;
  label: string;
  unit: string;
}[] = [
  { key: 'calories', label: 'קלוריות יומיות', unit: "קל'" },
  { key: 'protein', label: 'חלבון', unit: "גר'" },
  { key: 'carbs', label: 'פחמימות', unit: "גר'" },
  { key: 'fat', label: 'שומן', unit: "גר'" },
];

export const GoalsEditor = memo(function GoalsEditor({
  goals,
  coachTarget,
  onSave,
  onClose,
}: GoalsEditorProps) {
  const [draft, setDraft] = useState({
    calories: goals.calories,
    protein: goals.protein,
    carbs: goals.carbs,
    fat: goals.fat,
  });

  const setField = (key: keyof typeof draft, value: number) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleAutoCalc = () => {
    const stored = safeJsonParse<StoredProfile>(localStorage.getItem('user_profile')) ?? {};
    const weightKg = typeof stored.weight === 'number' ? stored.weight : 70;
    const heightCm = typeof stored.height === 'number' ? stored.height : 175;
    const age = typeof stored.age === 'number' ? stored.age : 25;
    const gender = stored.gender ?? 'male';
    const macros = computeMacrosFromProfile({
      weightKg,
      heightCm,
      age,
      gender,
      activityLevel: stored.activityLevel ?? 'פעיל מתון',
      weightGoal: stored.weightGoal ?? 'שמירה על משקל',
    });
    setDraft({
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
    });
  };

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
        className="w-full max-w-lg rounded-t-[28px] max-h-[88vh] overflow-y-auto"
        style={{
          background: 'var(--fs-surface)',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))',
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="עריכת יעדי תזונה"
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--fs-surface-2)' }} />
        </div>

        <div
          className="sticky top-0 z-10 px-5 pt-[max(env(safe-area-inset-top,0px),8px)] pb-4"
          style={{ background: 'var(--fs-surface)', borderBottom: '1px solid var(--fs-surface-2)' }}
        >
          <div className="flex items-center justify-between">
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                fontWeight: 800,
                color: 'var(--fs-ink)',
                textTransform: 'uppercase',
              }}
            >
              ערוך יעדים
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="w-12 h-12 flex items-center justify-center"
              style={{
                borderRadius: '50%',
                background: 'var(--fs-surface-2)',
                color: 'var(--fs-muted)',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label="סגור"
            >
              <X size={17} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {coachTarget && (
            <div
              className="flex items-center gap-2"
              style={{
                padding: '12px 14px',
                background: 'var(--fs-surface-2)',
                border: '1px solid var(--fs-accent)',
                color: 'var(--fs-ink)',
                fontFamily: 'var(--font-body)',
                fontSize: 13,
              }}
            >
              <Lock
                size={15}
                style={{ color: 'var(--fs-accent)', flexShrink: 0 }}
                aria-hidden="true"
              />
              היעד נקבע ע״י המאמן ולא ניתן לעריכה כאן.
            </div>
          )}

          {!coachTarget && (
            <button
              type="button"
              onClick={handleAutoCalc}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: 'var(--fs-primary)',
                border: 'none',
                borderRadius: 0,
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--fs-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Zap size={13} />
              חשב מהפרופיל (TDEE)
            </button>
          )}

          {FIELDS.map((f) => (
            <label
              key={f.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-hebrew)',
                  fontSize: 14,
                  fontWeight: 600,
                  color: 'var(--fs-ink)',
                }}
              >
                {f.label}
              </span>
              <span className="flex items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={draft[f.key]}
                  disabled={coachTarget}
                  onChange={(e) => setField(f.key, Math.max(0, Number(e.target.value) || 0))}
                  dir="ltr"
                  style={{
                    width: 96,
                    textAlign: 'center',
                    background: 'var(--fs-surface-2)',
                    border: '1px solid var(--fs-surface-2)',
                    borderRadius: 12,
                    padding: '12px 8px',
                    color: 'var(--fs-ink)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 15,
                    minHeight: 48,
                    opacity: coachTarget ? 0.5 : 1,
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--fs-muted)',
                    minWidth: 28,
                  }}
                >
                  {f.unit}
                </span>
              </span>
            </label>
          ))}

          <motion.button
            onClick={() => onSave(draft)}
            disabled={coachTarget}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: 0,
              backgroundColor: coachTarget ? 'var(--fs-surface-2)' : 'var(--fs-primary)',
              color: coachTarget ? 'var(--fs-muted)' : 'var(--fs-accent)',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '16px',
              textTransform: 'uppercase',
              border: 'none',
              cursor: coachTarget ? 'not-allowed' : 'pointer',
              opacity: coachTarget ? 0.4 : 1,
            }}
            whileTap={{ scale: coachTarget ? 1 : 0.98 }}
          >
            שמור יעדים
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
});
