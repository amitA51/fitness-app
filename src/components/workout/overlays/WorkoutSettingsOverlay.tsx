// WorkoutSettingsOverlay — Simplified Fresh Steel design
//
// User-requested scope (only these settings are surfaced, all wired to behavior):
//   General  : defaultWorkoutGoal · hapticsEnabled · keepAwake
//   Rest     : defaultRestTime · restTimerVibrate · restTimerSound
//   Audio    : soundEnabled · countdownBeepEnabled
//   Flow     : warmupPreference · cooldownPreference · waterReminder(+interval)
//   Advanced : a small curated set the rest of the app actually reads
//
// Everything else from the old overlay (themes, intensity meter, OLED, gym-mode,
// PR celebrations, supersets toggle, CSV export toggle, body-weight prompts…)
// has been removed because it was either UI-only or duplicated by global Settings.

import { AnimatePresence, type PanInfo, m } from 'framer-motion';
import { X as CloseIcon } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { useSettings } from '../../../contexts/SettingsContext';
import type { WorkoutSettings } from '../../../types';
import { ModalOverlay } from '../../ui/ModalOverlay';
import { DEFAULT_WORKOUT_SETTINGS } from '../hooks/useWorkoutSettings';

import {
  ChipSelector,
  Divider,
  GoalSelector,
  RestTimeSelector,
  SETTINGS_TABS,
  SectionHeader,
  SliderSetting,
  TabBar,
  Toggle,
  triggerSettingsHaptic as triggerHaptic,
} from './SettingsPrimitives';
import type { SettingsTab } from './SettingsPrimitives';

// ============================================================
// TYPES
// ============================================================

interface WorkoutSettingsOverlayProps {
  isOpen: boolean;
  settings: Partial<WorkoutSettings>;
  onClose: () => void;
  onUpdateSetting: (key: string, value: unknown) => void;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

const WorkoutSettingsOverlay = memo<WorkoutSettingsOverlayProps>(
  ({ isOpen, settings, onClose, onUpdateSetting }) => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');

    // Dark mode is an app-level setting (toggles the `.dark` class on <html> via
    // SettingsContext), not a workout-scoped one — so it's wired straight to the
    // global settings store rather than through onUpdateSetting.
    const { settings: appSettings, updateSettings } = useSettings();

    const handleDragEnd = (_: unknown, info: PanInfo) => {
      if (info.offset.y > 100) onClose();
    };

    const handleClose = useCallback(() => {
      triggerHaptic();
      onClose();
    }, [onClose]);

    // Read a setting with a sensible default fallback so toggles never look
    // "stale" before the first localStorage write.
    const get = useCallback(
      <K extends keyof WorkoutSettings>(key: K): WorkoutSettings[K] | undefined => {
        const value = settings[key];
        return value !== undefined ? value : DEFAULT_WORKOUT_SETTINGS[key];
      },
      [settings]
    );

    useEffect(() => {
      if (isOpen) setActiveTab('general');
    }, [isOpen]);

    return (
      <ModalOverlay
        isOpen={isOpen}
        onClose={onClose}
        variant="none"
        zLevel="ultra"
        backdropOpacity={50}
        blur="sm"
        trapFocus
        lockScroll
        closeOnBackdropClick
        closeOnEscape
        ariaLabel="הגדרות אימון"
      >
        {/* Custom backdrop with motion-value for drag interaction */}
        <m.div
          className="absolute inset-0"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={handleClose}
        />

        <m.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.4 }}
          onDragEnd={handleDragEnd}
          style={{
            background: 'var(--fs-bg)',
            borderTop: '2px solid var(--fs-primary)',
            borderRadius: '24px 24px 0 0',
            boxShadow: '0 -12px 32px rgba(11,26,43,0.2)',
            maxHeight: '88vh',
          }}
          className="fixed bottom-0 left-0 right-0 flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                background: 'var(--fs-surface-2)',
              }}
            />
          </div>

          {/* Navy masthead — title + close button */}
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{
              background: 'var(--fs-primary)',
            }}
          >
            <div className="text-start">
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.22em',
                  color: 'var(--fs-accent)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                הגדרות
              </div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 22,
                  fontWeight: 900,
                  letterSpacing: '-0.01em',
                  color: 'var(--color-ink-on-dark)',
                  lineHeight: 1,
                  marginTop: 4,
                }}
              >
                אימון
              </h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              aria-label="סגור"
              style={{
                width: 40,
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.12)',
                border: 'none',
                borderRadius: 0,
                color: 'var(--color-ink-on-dark)',
                cursor: 'pointer',
              }}
            >
              <CloseIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Tab bar */}
          <div className="pt-3" style={{ background: 'var(--fs-bg)' }}>
            <TabBar tabs={SETTINGS_TABS} activeTab={activeTab} onTabChange={setActiveTab} />
          </div>

          {/* Body */}
          <div
            className="flex-1 overflow-y-auto overscroll-contain px-5 pb-safe-bottom"
            style={{ background: 'var(--fs-bg)' }}
          >
            <AnimatePresence mode="sync">
              {/* ────── GENERAL ────── */}
              {activeTab === 'general' && (
                <m.div
                  key="general"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="py-2"
                >
                  <GoalSelector
                    value={(get('defaultWorkoutGoal') as string | undefined) || 'general'}
                    onChange={(v) => onUpdateSetting('defaultWorkoutGoal', v)}
                  />
                  <Divider />
                  <SectionHeader title="תצוגה" />
                  <Toggle
                    label="מצב כהה"
                    description="ערכת צבעים כהה לכל האפליקציה"
                    value={appSettings.darkMode ?? false}
                    onChange={(v) => updateSettings({ darkMode: v })}
                  />
                  <Divider />
                  <SectionHeader title="התנהגות" />
                  <Toggle
                    label="רטט"
                    description="משוב רטט בלחיצות ובסיום סט/מנוחה"
                    value={get('hapticsEnabled') ?? true}
                    onChange={(v) => onUpdateSetting('hapticsEnabled', v)}
                  />
                  <Toggle
                    label="שמור מסך דלוק"
                    description="מניעת כיבוי מסך באמצע אימון"
                    value={get('keepAwake') ?? true}
                    onChange={(v) => onUpdateSetting('keepAwake', v)}
                  />
                </m.div>
              )}

              {/* ────── REST ────── */}
              {activeTab === 'rest' && (
                <m.div
                  key="rest"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="py-2"
                >
                  <RestTimeSelector
                    value={get('defaultRestTime') ?? 90}
                    onChange={(v) => onUpdateSetting('defaultRestTime', v)}
                  />
                  <Divider />
                  <SectionHeader title="התראת סיום מנוחה" />
                  <Toggle
                    label="רטט בסיום מנוחה"
                    description="רטט כשהטיימר מסתיים"
                    value={get('restTimerVibrate') ?? true}
                    onChange={(v) => onUpdateSetting('restTimerVibrate', v)}
                  />
                  <Toggle
                    label="צליל בסיום מנוחה"
                    description="צליל התראה בסיום מנוחה"
                    value={get('restTimerSound') ?? true}
                    onChange={(v) => onUpdateSetting('restTimerSound', v)}
                  />
                  <Toggle
                    label="טיימר אוטומטי"
                    description="התחל מנוחה אוטומטית אחרי סט"
                    value={get('autoStartRest') ?? true}
                    onChange={(v) => onUpdateSetting('autoStartRest', v)}
                  />
                  <Toggle
                    label="הוספת סטים אוטומטית"
                    description="הוסף סט חדש אוטומטית בסיום הסט האחרון. כבוי = מספר הסטים קבוע ומוסיפים ידנית"
                    value={get('autoAddSets') ?? false}
                    onChange={(v) => onUpdateSetting('autoAddSets', v)}
                  />
                </m.div>
              )}

              {/* ────── AUDIO ────── */}
              {activeTab === 'audio' && (
                <m.div
                  key="audio"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="py-2"
                >
                  <Toggle
                    label="צלילים מופעלים"
                    description="כיבוי כללי של כל אפקטי הסאונד באפליקציה"
                    value={get('soundEnabled') ?? true}
                    onChange={(v) => onUpdateSetting('soundEnabled', v)}
                  />
                  <Toggle
                    label="ביפים בספירה לאחור"
                    description="צלילי ביפ ב‎-‎10, 5, 3, 2, 1"
                    value={get('countdownBeepEnabled') ?? true}
                    onChange={(v) => onUpdateSetting('countdownBeepEnabled', v)}
                  />
                </m.div>
              )}

              {/* ────── FLOW (warmup/cooldown/water) ────── */}
              {activeTab === 'flow' && (
                <m.div
                  key="flow"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="py-2"
                >
                  <SectionHeader title="חימום וצינון" />
                  <ChipSelector
                    label="הצג הנחיות חימום"
                    options={[
                      { value: 'always', label: 'תמיד' },
                      { value: 'ask', label: 'שאל' },
                      { value: 'never', label: 'אף פעם' },
                    ]}
                    value={(get('warmupPreference') as string | undefined) || 'ask'}
                    onChange={(v) => onUpdateSetting('warmupPreference', v)}
                  />
                  <ChipSelector
                    label="הצג הנחיות צינון"
                    options={[
                      { value: 'always', label: 'תמיד' },
                      { value: 'ask', label: 'שאל' },
                      { value: 'never', label: 'אף פעם' },
                    ]}
                    value={(get('cooldownPreference') as string | undefined) || 'ask'}
                    onChange={(v) => onUpdateSetting('cooldownPreference', v)}
                  />
                  <Divider />
                  <SectionHeader title="תזכורות שתייה" />
                  <Toggle
                    label="תזכורת לשתות מים"
                    description="הודעה תקופתית במהלך אימון"
                    value={get('waterReminderEnabled') ?? false}
                    onChange={(v) => onUpdateSetting('waterReminderEnabled', v)}
                  />
                  {get('waterReminderEnabled') && (
                    <SliderSetting
                      label="כל כמה דקות"
                      value={get('waterReminderInterval') ?? 15}
                      min={5}
                      max={60}
                      step={5}
                      unit=" דקות"
                      onChange={(v) => onUpdateSetting('waterReminderInterval', v)}
                    />
                  )}
                </m.div>
              )}

              {/* ────── ADVANCED ────── */}
              {activeTab === 'advanced' && (
                <m.div
                  key="advanced"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="py-2"
                >
                  <div
                    style={{
                      padding: 14,
                      marginBottom: 8,
                      background: 'var(--fs-surface)',
                      border: '1px solid var(--fs-surface-2)',
                      borderInlineStart: '3px solid var(--fs-accent)',
                    }}
                  >
                    <p
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 12,
                        color: 'var(--fs-muted)',
                        lineHeight: 1.5,
                        margin: 0,
                      }}
                    >
                      הגדרות מתקדמות עבור משתמשים מנוסים. כולן משפיעות על התנהגות האימון בזמן אמת.
                    </p>
                  </div>

                  <SectionHeader title="תצוגת נתונים" />
                  <Toggle
                    label="ערכים מאימון קודם"
                    description="הצג משקל וחזרות מהאימון האחרון כרמז"
                    value={get('showGhostValues') ?? true}
                    onChange={(v) => onUpdateSetting('showGhostValues', v)}
                  />
                  <Toggle
                    label="תצוגה מקדימה של נפח"
                    description="הצג נפח צפוי בכל סט"
                    value={get('showVolumePreview') ?? true}
                    onChange={(v) => onUpdateSetting('showVolumePreview', v)}
                  />
                  <Toggle
                    label="כפתורי משקל מהירים"
                    description="הצג +/- לשינוי משקל מהיר"
                    value={get('enableQuickWeightButtons') ?? true}
                    onChange={(v) => onUpdateSetting('enableQuickWeightButtons', v)}
                  />
                  <Toggle
                    label="כפתורי חזרות מהירים"
                    description="הצג +/- לשינוי חזרות מהיר"
                    value={get('enableQuickRepsButtons') ?? true}
                    onChange={(v) => onUpdateSetting('enableQuickRepsButtons', v)}
                  />
                  <Divider />

                  <SectionHeader title="התקדמות אוטומטית" />
                  <Toggle
                    label="הגדלה אוטומטית של משקל"
                    description="הצע להעלות משקל בהתקדמות עקבית"
                    value={get('autoIncrementWeight') ?? false}
                    onChange={(v) => onUpdateSetting('autoIncrementWeight', v)}
                  />
                  {get('autoIncrementWeight') && (
                    <SliderSetting
                      label="כמות הגדלה"
                      value={get('weightIncrementAmount') ?? 2.5}
                      min={0.5}
                      max={10}
                      step={0.5}
                      unit=" ק״ג"
                      onChange={(v) => onUpdateSetting('weightIncrementAmount', v)}
                    />
                  )}
                  <Toggle
                    label="התראות שיא אישי"
                    description="הצג חגיגה כשנשבר שיא"
                    value={get('enablePRAlerts') ?? true}
                    onChange={(v) => onUpdateSetting('enablePRAlerts', v)}
                  />
                  <Divider />

                  <SectionHeader title="נגישות" />
                  <Toggle
                    label="צמצום אנימציות"
                    description="פחות תנועה לחוויה רגועה יותר"
                    value={get('reducedAnimations') ?? false}
                    onChange={(v) => onUpdateSetting('reducedAnimations', v)}
                  />
                  <Toggle
                    label="טקסט גדול"
                    description="הגדלת גודל הפונט ב‎-‎20%"
                    value={get('largeText') ?? false}
                    onChange={(v) => onUpdateSetting('largeText', v)}
                  />
                  <Toggle
                    label="ניגודיות גבוהה"
                    description="הגברת ניגודיות צבעים"
                    value={get('highContrast') ?? false}
                    onChange={(v) => onUpdateSetting('highContrast', v)}
                  />
                </m.div>
              )}
            </AnimatePresence>
            <div style={{ height: 32 }} />
          </div>
        </m.div>

        <style>{`
                .hide-scrollbar::-webkit-scrollbar { display: none; }
                .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .pb-safe-bottom { padding-bottom: env(safe-area-inset-bottom, 24px); }
            `}</style>
      </ModalOverlay>
    );
  }
);

WorkoutSettingsOverlay.displayName = 'WorkoutSettingsOverlay';

export default WorkoutSettingsOverlay;
