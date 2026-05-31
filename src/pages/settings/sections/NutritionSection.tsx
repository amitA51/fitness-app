import { Dumbbell, Target, Zap } from 'lucide-react';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { NumberInput } from '../../../components/ui/SettingsNumberInput';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { SaveButton } from '../../../components/ui/SettingsSaveButton';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import { computeMacrosFromProfile } from '../../../services/settingsService';
import type { NutritionGoals, UserProfile } from '../types';
import { loadFromStorage } from '../types';

interface Props {
  profile: UserProfile;
  nutrition: NutritionGoals;
  setNutrition: (n: NutritionGoals) => void;
  nutritionSaved: boolean;
  onSave: () => void;
}

export function NutritionSection({
  profile,
  nutrition,
  setNutrition,
  nutritionSaved,
  onSave,
}: Props) {
  const handleAutoCalc = () => {
    const storedProfile = loadFromStorage<{ weight?: number; gender?: string }>('user_profile', {});
    const weightKg = typeof storedProfile.weight === 'number' ? storedProfile.weight : 70;
    const heightCm = typeof profile.height === 'number' ? profile.height : 175;
    const age = typeof profile.age === 'number' ? profile.age : 25;
    const gender = (storedProfile.gender as 'male' | 'female' | 'other') ?? 'male';
    const macros = computeMacrosFromProfile({
      weightKg,
      heightCm,
      age,
      gender,
      activityLevel: profile.activityLevel,
      weightGoal: profile.weightGoal,
    });
    setNutrition({
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
    });
  };

  return (
    <div className="mb-7">
      <SectionLabel num="02" titleEn="NUTRITION · GOALS">
        יעדי תזונה
      </SectionLabel>

      {profile.age && profile.height && profile.weightGoal && profile.activityLevel && (
        <button
          type="button"
          onClick={handleAutoCalc}
          style={{
            width: '100%',
            marginBottom: 12,
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
          חשב אוטומטית מהפרופיל (TDEE)
        </button>
      )}

      <SettingsCard>
        <SettingsRow
          icon={<Target size={15} style={{ color: 'var(--fs-warn)' }} />}
          label="קלוריות יומיות"
          divider={true}
        >
          <NumberInput
            value={nutrition.calories}
            onChange={(v) => setNutrition({ ...nutrition, calories: v })}
            min={0}
            placeholder="—"
            unit="קל'"
          />
        </SettingsRow>

        <SettingsRow
          icon={<Dumbbell size={15} style={{ color: 'var(--fs-accent)' }} />}
          label="חלבון"
          divider={true}
        >
          <NumberInput
            value={nutrition.protein}
            onChange={(v) => setNutrition({ ...nutrition, protein: v })}
            min={0}
            placeholder="—"
            unit="גר'"
          />
        </SettingsRow>

        <SettingsRow
          icon={
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '12px',
                color: 'var(--fs-accent-2)',
              }}
            >
              פח
            </span>
          }
          label="פחמימות"
          divider={true}
        >
          <NumberInput
            value={nutrition.carbs}
            onChange={(v) => setNutrition({ ...nutrition, carbs: v })}
            min={0}
            placeholder="—"
            unit="גר'"
          />
        </SettingsRow>

        <SettingsRow
          icon={
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '12px',
                color: 'var(--fs-warn)',
              }}
            >
              שמ
            </span>
          }
          label="שומן"
          divider={false}
        >
          <NumberInput
            value={nutrition.fat}
            onChange={(v) => setNutrition({ ...nutrition, fat: v })}
            min={0}
            placeholder="—"
            unit="גר'"
          />
        </SettingsRow>
      </SettingsCard>

      <div className="mt-3">
        <SaveButton onClick={onSave} saved={nutritionSaved} label="שמור יעדי תזונה" />
      </div>
    </div>
  );
}
