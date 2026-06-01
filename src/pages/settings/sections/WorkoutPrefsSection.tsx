import { Bell, Dumbbell, Zap } from 'lucide-react';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SettingsRow } from '../../../components/ui/SettingsRow';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import { SettingsToggle } from '../../../components/ui/SettingsToggle';
import { Divider } from '../components/Divider';
import { IconBox } from '../components/IconBox';
import { SavedIndicator } from '../components/SavedIndicator';
import type { WorkoutPrefs } from '../types';
import { REST_TIME_OPTIONS } from '../types';

interface Props {
  workoutPrefs: WorkoutPrefs;
  /** Immediate autosave — every control here is a discrete choice. */
  commitWorkout: (p: WorkoutPrefs) => void;
  workoutSaved: boolean;
}

export function WorkoutPrefsSection({ workoutPrefs, commitWorkout, workoutSaved }: Props) {
  return (
    <div className="mb-7">
      <SectionLabel trailing={<SavedIndicator saved={workoutSaved} />}>אימון</SectionLabel>
      <SettingsCard>
        {/* Rest time pills */}
        <div className="px-4 py-4">
          <div className="flex items-center gap-3 mb-3">
            <IconBox>
              <Dumbbell size={15} />
            </IconBox>
            <span
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: '15px',
                fontWeight: 500,
                color: 'var(--fs-ink)',
              }}
            >
              זמן מנוחה ברירת מחדל
            </span>
          </div>
          <div
            className="flex flex-wrap gap-2 pe-11"
            role="group"
            aria-label="זמן מנוחה ברירת מחדל"
          >
            {REST_TIME_OPTIONS.map((opt) => {
              const active = workoutPrefs.defaultRestTime === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  aria-pressed={active}
                  onClick={() => commitWorkout({ ...workoutPrefs, defaultRestTime: opt.value })}
                  style={{
                    minHeight: '44px',
                    padding: '8px 14px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: 0,
                    cursor: 'pointer',
                    border: '1px solid var(--fs-surface-2)',
                    transition: 'all 0.15s ease',
                    ...(active
                      ? { background: 'var(--fs-primary)', color: 'var(--fs-accent)' }
                      : { background: 'transparent', color: 'var(--fs-muted)' }),
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <Divider />

        {/* Auto start rest */}
        <SettingsRow
          icon={<Bell size={15} style={{ color: 'var(--fs-accent)' }} />}
          label="התחלה אוטומטית של טיימר"
          divider={true}
        >
          <SettingsToggle
            checked={workoutPrefs.autoStartRest}
            onChange={() =>
              commitWorkout({ ...workoutPrefs, autoStartRest: !workoutPrefs.autoStartRest })
            }
            label="התחלה אוטומטית"
          />
        </SettingsRow>

        {/* Haptics */}
        <SettingsRow
          icon={<Zap size={15} style={{ color: 'var(--fs-accent)' }} />}
          label="רטט (Haptic Feedback)"
          divider={false}
        >
          <SettingsToggle
            checked={workoutPrefs.hapticsEnabled}
            onChange={() =>
              commitWorkout({ ...workoutPrefs, hapticsEnabled: !workoutPrefs.hapticsEnabled })
            }
            label="רטט"
          />
        </SettingsRow>
      </SettingsCard>
    </div>
  );
}
