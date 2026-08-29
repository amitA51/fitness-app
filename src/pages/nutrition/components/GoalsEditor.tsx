import { Droplets, GlassWater, Lock, Zap } from 'lucide-react';
import { memo, useState } from 'react';
import { showToast } from '../../../components/ui/GlobalToast';
import { Sheet } from '../../../components/ui/Sheet';
import { computeMacrosFromProfile } from '../../../services/settingsService';
import { getWaterSettings, saveWaterSettings } from '../../../services/waterService';
import type { MacroNutrients } from '../../../types';
import { safeJsonParse } from '../../../utils/safeJson';

interface GoalsEditorProps {
  /** Whether the editor sheet is open. */
  isOpen: boolean;
  goals: MacroNutrients;
  /** When true the macro goals are coach-assigned and editing is disabled. */
  coachTarget: boolean;
  onSave: (goals: MacroNutrients) => boolean;
  onClose: () => void;
}

interface StoredProfile {
  weight?: number;
  height?: number | '';
  age?: number | '';
  gender?: 'male' | 'female' | 'other' | '';
  activityLevel?: string;
  weightGoal?: string;
}

/** Present, finite and positive — what Mifflin-St Jeor accepts as an answer. */
const isMeasured = (value: number | '' | undefined): boolean =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

/**
 * The profile rows the calorie target genuinely depends on, labelled exactly as
 * Settings labels them under "פרטים אישיים". Each has its own "not answered"
 * state (`''` or absent), so the refusal can name the rows that are actually
 * empty instead of a generic "details missing" the user cannot act on.
 */
function missingProfileFields(stored: StoredProfile): string[] {
  const missing: string[] = [];
  if (!isMeasured(stored.weight)) missing.push('משקל');
  if (!isMeasured(stored.height)) missing.push('גובה');
  if (!isMeasured(stored.age)) missing.push('גיל');
  // 'other' IS an answer — calculateBMR applies the +5 term to it. Only '' or
  // an absent field means the user never told us.
  if (stored.gender !== 'male' && stored.gender !== 'female' && stored.gender !== 'other') {
    missing.push('מין');
  }
  if (!stored.activityLevel) missing.push('רמת פעילות');
  return missing;
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

interface NumberFieldProps {
  label: string;
  unit: string;
  value: number;
  disabled?: boolean;
  icon?: React.ReactNode;
  onChange: (value: number) => void;
}

function NumberField({ label, unit, value, disabled, icon, onChange }: NumberFieldProps) {
  return (
    <label
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
    >
      <span
        className="flex items-center gap-2"
        style={{
          fontFamily: 'var(--font-hebrew)',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--fs-ink)',
        }}
      >
        {icon}
        {label}
      </span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          dir="ltr"
          aria-label={label}
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
            opacity: disabled ? 0.5 : 1,
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
          {unit}
        </span>
      </span>
    </label>
  );
}

export const GoalsEditor = memo(function GoalsEditor({
  isOpen,
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
  // Water settings are independent of the coach macro target, so they live in
  // their own draft and persist through the dedicated water service helpers.
  const [water, setWater] = useState(() => getWaterSettings());

  const setField = (key: keyof typeof draft, value: number) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleAutoCalc = () => {
    const stored = safeJsonParse<StoredProfile>(localStorage.getItem('user_profile')) ?? {};
    // No substituted values. This used to supply weight 70 / height 175 / age 25
    // / gender male / activityLevel 'פעיל מתון' / weightGoal 'שמירה על משקל' —
    // six invented inputs behind one button — and present the result as the
    // user's own macros. computeMacrosFromProfile now returns zeros when it
    // cannot honestly compute, and we publish nothing rather than a guess.
    const macros = computeMacrosFromProfile({
      weightKg: typeof stored.weight === 'number' ? stored.weight : null,
      heightCm: typeof stored.height === 'number' ? stored.height : null,
      age: typeof stored.age === 'number' ? stored.age : null,
      gender: stored.gender ?? '',
      activityLevel: stored.activityLevel ?? '',
      weightGoal: stored.weightGoal ?? 'שמירה על משקל',
    });
    if (macros.calories <= 0) {
      // Withholding the NUMBER is right; withholding the REASON was not — the
      // button did nothing at all. Name the rows that are genuinely empty and
      // where to fill them, through the app's canonical toast (GlobalToast,
      // already the feedback channel for this screen via useNutritionData).
      const missing = missingProfileFields(stored);
      showToast(
        missing.length > 0
          ? `כדי לחשב יעד צריך להשלים בפרופיל: ${missing.join(', ')}`
          : 'לא הצלחנו לחשב יעד מהפרטים שבפרופיל',
        {
          variant: 'info',
          // Longer than the 3s default: the message names fields and a screen.
          duration: 6000,
          description: 'השלימו בהגדרות, בקטע "פרטים אישיים", ואז לחצו שוב.',
        }
      );
      return;
    }
    setDraft({
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
    });
  };

  const handleSave = () => {
    // Persist water settings first (always allowed); then macro goals, which
    // the parent refuses when a coach target is active. Close only if the macro
    // save was accepted so the lock message stays visible when blocked.
    saveWaterSettings(water);
    const accepted = onSave(draft);
    if (accepted || coachTarget) onClose();
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="ערוך יעדים"
      ariaLabel="עריכת יעדי תזונה"
      footer={
        <button
          type="button"
          onClick={handleSave}
          style={{
            width: '100%',
            minHeight: 52,
            padding: '16px',
            borderRadius: 12,
            backgroundColor: 'var(--fs-primary)',
            color: 'var(--fs-accent)',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '16px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          שמור יעדים
        </button>
      }
    >
      <div className="space-y-4">
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
              minHeight: 44,
              padding: '10px 16px',
              background: 'var(--fs-primary)',
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '-0.01em',
              color: 'var(--fs-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Zap size={13} aria-hidden="true" />
            חשב מהפרופיל (TDEE)
          </button>
        )}

        {FIELDS.map((f) => (
          <NumberField
            key={f.key}
            label={f.label}
            unit={f.unit}
            value={draft[f.key]}
            disabled={coachTarget}
            onChange={(v) => setField(f.key, v)}
          />
        ))}

        {/* Water goals — always editable, independent of the coach macro target */}
        <div className="pt-4 mt-2 space-y-4" style={{ borderTop: '1px solid var(--fs-surface-2)' }}>
          <h3
            className="flex items-center gap-2"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--fs-ink)',
            }}
          >
            <Droplets size={15} style={{ color: 'var(--fs-accent)' }} aria-hidden="true" />
            יעדי שתייה
          </h3>
          <NumberField
            label="יעד מים יומי"
            unit='מ"ל'
            value={water.goalMl}
            icon={<Droplets size={14} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />}
            onChange={(v) => setWater((prev) => ({ ...prev, goalMl: v }))}
          />
          <NumberField
            label="גודל כוס"
            unit='מ"ל'
            value={water.glassMl}
            icon={<GlassWater size={14} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />}
            onChange={(v) => setWater((prev) => ({ ...prev, glassMl: v }))}
          />
        </div>
      </div>
    </Sheet>
  );
});
