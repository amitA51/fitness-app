// WorkoutSettingsOverlay - Complete Settings with Full Functionality
// All settings are connected to actual features via useWorkoutSettings hook
// Uses Portal rendering via ModalOverlay for proper z-index stacking and focus management

import { AnimatePresence, type PanInfo, motion, useMotionValue, useTransform } from 'framer-motion';
import { memo, useCallback, useEffect, useState } from 'react';
import type { WorkoutSettings } from '../../../types';
import { CloseIcon } from '../../icons';
import { ModalOverlay } from '../../ui/ModalOverlay';
import AnalyticsDashboard from '../AnalyticsDashboard';
import ExerciseLibraryTab from '../ExerciseLibraryTab';
import PRHistoryTab from '../PRHistoryTab';
import { DEFAULT_WORKOUT_SETTINGS } from '../hooks/useWorkoutSettings';

// Extracted primitives
import {
  ChipSelector,
  Divider,
  GoalSelector,
  RestTimeSelector,
  SETTINGS_TABS,
  SectionHeader,
  SliderSetting,
  TabBar,
  ThemeSelector,
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
    const y = useMotionValue(0);
    const backdropOpacity = useTransform(y, [0, 200], [1, 0]);

    const handleDragEnd = (_: unknown, info: PanInfo) => {
      if (info.offset.y > 100) onClose();
    };

    const handleClose = useCallback(() => {
      triggerHaptic();
      onClose();
    }, [onClose]);

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
        backdropOpacity={70}
        blur="xl"
        trapFocus
        lockScroll
        closeOnBackdropClick
        closeOnEscape
        ariaLabel="הגדרות אימון"
      >
        {/* Custom backdrop with motion value for drag interaction */}
        <motion.div
          className="absolute inset-0 bg-black/70"
          style={{ opacity: backdropOpacity }}
          onClick={handleClose}
        />

        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.4 }}
          onDragEnd={handleDragEnd}
          style={{ y }}
          className="fixed bottom-0 left-0 right-0 flex flex-col rounded-t-3xl overflow-hidden bg-[var(--bg-secondary,#121212)] max-h-[85vh]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-center py-3">
            <div className="w-12 h-1 rounded-full bg-white/30" />
          </div>

          <div className="px-5 pb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">הגדרות</h2>
            <button
              type="button"
              onClick={handleClose}
              className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center active:bg-white/20"
            >
              <CloseIcon className="w-5 h-5 text-white/70" />
            </button>
          </div>

          <TabBar tabs={SETTINGS_TABS} activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="flex-1 overflow-y-auto overscroll-contain px-5 pb-safe-bottom">
            <AnimatePresence mode="sync">
              {/* GENERAL TAB */}
              {activeTab === 'general' && (
                <motion.div
                  key="general"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="py-2"
                >
                  <GoalSelector
                    value={get('defaultWorkoutGoal') || 'general'}
                    onChange={(v) => onUpdateSetting('defaultWorkoutGoal', v)}
                  />
                  <Divider />
                  <SectionHeader title="התנהגות" />
                  <Toggle
                    label="רטט"
                    description="משוב רטט בלחיצות ואירועים"
                    value={get('hapticsEnabled') ?? true}
                    onChange={(v) => onUpdateSetting('hapticsEnabled', v)}
                  />
                  <Toggle
                    label="שמור מסך דלוק"
                    description="מניעת כיבוי מסך באימון"
                    value={get('keepAwake') ?? true}
                    onChange={(v) => onUpdateSetting('keepAwake', v)}
                  />
                  <Toggle
                    label="הגדלה אוטומטית של משקל"
                    description="הצע להעלות משקל בהתקדמות"
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
                </motion.div>
              )}

              {/* DISPLAY TAB */}
              {activeTab === 'display' && (
                <motion.div
                  key="display"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="py-2"
                >
                  <ThemeSelector
                    value={get('selectedTheme') || 'deepCosmos'}
                    onChange={(v) => onUpdateSetting('selectedTheme', v)}
                  />
                  <Divider />
                  <Toggle
                    label="מצב OLED"
                    description="רקע שחור מוחלט לחיסכון בסוללה"
                    value={get('oledMode') ?? false}
                    onChange={(v) => onUpdateSetting('oledMode', v)}
                  />
                  <Divider />
                  <SectionHeader title="תצוגת נתונים" />
                  <Toggle
                    label="ערכים מאימון קודם"
                    description="הצג משקל וחזרות מהאימון האחרון"
                    value={get('showGhostValues') ?? true}
                    onChange={(v) => onUpdateSetting('showGhostValues', v)}
                  />
                  <Toggle
                    label="תצוגה מקדימה של נפח"
                    description="הצג נפח צפוי בכל תרגיל"
                    value={get('showVolumePreview') ?? true}
                    onChange={(v) => onUpdateSetting('showVolumePreview', v)}
                  />
                  <Toggle
                    label="מד עצימות"
                    description="הצג מד עצימות אימון בזמן אמת"
                    value={get('showIntensityMeter') ?? false}
                    onChange={(v) => onUpdateSetting('showIntensityMeter', v)}
                  />
                  <Toggle
                    label="סטטיסטיקות בזמן אמת"
                    description="הצג נתוני ביצועים מפורטים"
                    value={get('showPerformanceStats') ?? false}
                    onChange={(v) => onUpdateSetting('showPerformanceStats', v)}
                  />
                  <Toggle
                    label="מצב קומפקטי"
                    description="ממשק צפוף יותר למסכים קטנים"
                    value={get('compactMode') ?? false}
                    onChange={(v) => onUpdateSetting('compactMode', v)}
                  />
                </motion.div>
              )}

              {/* TIMERS TAB */}
              {activeTab === 'timers' && (
                <motion.div
                  key="timers"
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
                  <Toggle
                    label="טיימר אוטומטי"
                    description="התחל מנוחה אוטומטית אחרי סט"
                    value={get('autoStartRest') ?? true}
                    onChange={(v) => onUpdateSetting('autoStartRest', v)}
                  />
                  <Toggle
                    label="רטט בסיום מנוחה"
                    description="רטט כשהטיימר מסתיים"
                    value={get('restTimerVibrate') ?? true}
                    onChange={(v) => onUpdateSetting('restTimerVibrate', v)}
                  />
                  <Toggle
                    label="צליל בסיום מנוחה"
                    description="צליל התראה בסיום הפסקה"
                    value={get('restTimerSound') ?? true}
                    onChange={(v) => onUpdateSetting('restTimerSound', v)}
                  />
                  <Divider />

                  <SectionHeader title="טיימר מנוחה חכם" />
                  <Toggle
                    label="מנוחה חכמה"
                    description="התאם זמן מנוחה אוטומטית לפי סוג התרגיל"
                    value={get('smartRestEnabled') ?? false}
                    onChange={(v) => onUpdateSetting('smartRestEnabled', v)}
                  />
                  {get('smartRestEnabled') && (
                    <>
                      <SliderSetting
                        label="מנוחה קצרה (בידוד)"
                        description="לתרגילי בידוד קלים"
                        value={get('shortRestTime') ?? 60}
                        min={30}
                        max={120}
                        step={15}
                        unit=" שניות"
                        onChange={(v) => onUpdateSetting('shortRestTime', v)}
                      />
                      <SliderSetting
                        label="מנוחה בינונית (מורכב)"
                        description="לתרגילים מורכבים"
                        value={get('mediumRestTime') ?? 90}
                        min={60}
                        max={180}
                        step={15}
                        unit=" שניות"
                        onChange={(v) => onUpdateSetting('mediumRestTime', v)}
                      />
                      <SliderSetting
                        label="מנוחה ארוכה (כבד)"
                        description="להרמות כבדות"
                        value={get('longRestTime') ?? 180}
                        min={120}
                        max={300}
                        step={30}
                        unit=" שניות"
                        onChange={(v) => onUpdateSetting('longRestTime', v)}
                      />
                      <Toggle
                        label="הארך מנוחה אחרי כישלון"
                        description="הוסף זמן אם הסט היה קשה"
                        value={get('extendRestAfterFailure') ?? true}
                        onChange={(v) => onUpdateSetting('extendRestAfterFailure', v)}
                      />
                    </>
                  )}
                  <Divider />

                  <SectionHeader title="תצוגת טיימר" />
                  <ChipSelector
                    label="מצב תצוגה"
                    options={[
                      { value: 'countdown', label: 'ספירה לאחור' },
                      { value: 'countup', label: 'ספירה קדימה' },
                      { value: 'both', label: 'שניהם' },
                    ]}
                    value={get('timerDisplayMode') || 'countdown'}
                    onChange={(v) => onUpdateSetting('timerDisplayMode', v)}
                  />
                  <Toggle
                    label="טיימר בכותרת"
                    description="הצג טיימר מוקטן בכותרת"
                    value={get('showTimerInHeader') ?? true}
                    onChange={(v) => onUpdateSetting('showTimerInHeader', v)}
                  />
                  <Divider />

                  <SectionHeader title="חימום וצינון" />
                  <ChipSelector
                    label="הצג הנחיות חימום"
                    options={[
                      { value: 'always', label: 'תמיד' },
                      { value: 'ask', label: 'שאל' },
                      { value: 'never', label: 'אף פעם' },
                    ]}
                    value={get('warmupPreference') || 'ask'}
                    onChange={(v) => onUpdateSetting('warmupPreference', v)}
                  />
                  <ChipSelector
                    label="הצג הנחיות צינון"
                    options={[
                      { value: 'always', label: 'תמיד' },
                      { value: 'ask', label: 'שאל' },
                      { value: 'never', label: 'אף פעם' },
                    ]}
                    value={get('cooldownPreference') || 'ask'}
                    onChange={(v) => onUpdateSetting('cooldownPreference', v)}
                  />
                  <Divider />
                  <SectionHeader title="תזכורות" />
                  <Toggle
                    label="תזכורת לשתות מים"
                    description="תזכורת תקופתית לשתייה"
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
                </motion.div>
              )}

              {/* AUDIO TAB */}
              {activeTab === 'audio' && (
                <motion.div
                  key="audio"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="py-2"
                >
                  <SectionHeader title="צלילים" />
                  <Toggle
                    label="צלילים מופעלים"
                    description="אפקטי סאונד באפליקציה"
                    value={get('soundEnabled') ?? true}
                    onChange={(v) => onUpdateSetting('soundEnabled', v)}
                  />
                  <Toggle
                    label="ביפים בספירה לאחור"
                    description="צלילי ביפ ב-10, 5, 3, 2, 1"
                    value={get('countdownBeepEnabled') ?? true}
                    onChange={(v) => onUpdateSetting('countdownBeepEnabled', v)}
                  />
                  <Divider />
                  <SectionHeader title="הכרזות קוליות" />
                  <Toggle
                    label="ספירה קולית"
                    description="הכרזה קולית של הזמן הנותר"
                    value={get('voiceCountdownEnabled') ?? false}
                    onChange={(v) => onUpdateSetting('voiceCountdownEnabled', v)}
                  />
                  {get('voiceCountdownEnabled') && (
                    <>
                      <ChipSelector
                        label="שפת הכרזה"
                        options={[
                          { value: 'he-IL', label: 'עברית' },
                          { value: 'en-US', label: 'English' },
                        ]}
                        value={get('voiceLanguage') || 'he-IL'}
                        onChange={(v) => onUpdateSetting('voiceLanguage', v)}
                      />
                      <SliderSetting
                        label="עוצמת קול"
                        value={Math.round((get('voiceVolume') ?? 0.8) * 100)}
                        min={0}
                        max={100}
                        step={10}
                        unit="%"
                        onChange={(v) => onUpdateSetting('voiceVolume', v / 100)}
                      />
                    </>
                  )}
                </motion.div>
              )}

              {/* ACCESSIBILITY TAB */}
              {activeTab === 'accessibility' && (
                <motion.div
                  key="accessibility"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="py-2"
                >
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 mb-4">
                    <p className="text-[13px] text-white/60 leading-relaxed">
                      הגדרות אלו עוזרות להתאים את האפליקציה לצרכים שלך. השינויים יחולו מיד.
                    </p>
                  </div>
                  <Toggle
                    label="צמצום אנימציות"
                    description="הפחתת תנועות לחוויה רגועה יותר"
                    value={get('reducedAnimations') ?? false}
                    onChange={(v) => onUpdateSetting('reducedAnimations', v)}
                  />
                  <Toggle
                    label="טקסט גדול"
                    description="הגדלת גודל הפונט ב-20%"
                    value={get('largeText') ?? false}
                    onChange={(v) => onUpdateSetting('largeText', v)}
                  />
                  <Toggle
                    label="ניגודיות גבוהה"
                    description="הגברת ניגודיות צבעים"
                    value={get('highContrast') ?? false}
                    onChange={(v) => onUpdateSetting('highContrast', v)}
                  />
                </motion.div>
              )}

              {/* ADVANCED TAB */}
              {activeTab === 'advanced' && (
                <motion.div
                  key="advanced"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="py-2"
                >
                  <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-white/10 mb-4">
                    <p className="text-[13px] text-white/60 leading-relaxed">
                      הגדרות מתקדמות למשתמשים מנוסים. השתמש בזהירות.
                    </p>
                  </div>

                  <SectionHeader title="התקדמות הדרגתית" />
                  <Toggle
                    label="מעקב התקדמות"
                    description="עקוב והצע העלאת משקל"
                    value={get('enableProgressiveOverload') ?? true}
                    onChange={(v) => onUpdateSetting('enableProgressiveOverload', v)}
                  />
                  {get('enableProgressiveOverload') && (
                    <SliderSetting
                      label="אחוז העלאה שבועית"
                      value={get('progressiveOverloadPercent') ?? 2.5}
                      min={1}
                      max={10}
                      step={0.5}
                      unit="%"
                      onChange={(v) => onUpdateSetting('progressiveOverloadPercent', v)}
                    />
                  )}
                  <Toggle
                    label="מעקב 1RM"
                    description="חשב ועקוב אחרי הרמה מקסימלית משוערת"
                    value={get('enableOneRepMaxTracking') ?? true}
                    onChange={(v) => onUpdateSetting('enableOneRepMaxTracking', v)}
                  />
                  <Toggle
                    label="הצג הערות תרגיל"
                    description="הצג הערות מאימונים קודמים"
                    value={get('showExerciseNotes') ?? true}
                    onChange={(v) => onUpdateSetting('showExerciseNotes', v)}
                  />
                  <Divider />

                  <SectionHeader title="זרימת אימון" />
                  <Toggle
                    label="מעבר אוטומטי"
                    description="עבור אוטומטית לתרגיל הבא"
                    value={get('autoAdvanceExercise') ?? false}
                    onChange={(v) => onUpdateSetting('autoAdvanceExercise', v)}
                  />
                  <Toggle
                    label="אישור סיום תרגיל"
                    description="בקש אישור לפני מעבר"
                    value={get('confirmExerciseComplete') ?? true}
                    onChange={(v) => onUpdateSetting('confirmExerciseComplete', v)}
                  />
                  <Toggle
                    label="סופרסטים"
                    description="אפשר קיבוץ תרגילים לסופרסט"
                    value={get('enableSupersets') ?? false}
                    onChange={(v) => onUpdateSetting('enableSupersets', v)}
                  />
                  <Toggle
                    label="מנוחה בין תרגילים"
                    description="הצג טיימר מנוחה בין תרגילים"
                    value={get('showRestBetweenExercises') ?? true}
                    onChange={(v) => onUpdateSetting('showRestBetweenExercises', v)}
                  />
                  <Divider />

                  <SectionHeader title="שיאים אישיים" />
                  <Toggle
                    label="התראות PR"
                    description="התראה כשנשבר שיא"
                    value={get('enablePRAlerts') ?? true}
                    onChange={(v) => onUpdateSetting('enablePRAlerts', v)}
                  />
                  <ChipSelector
                    label="עוצמת חגיגה"
                    options={[
                      { value: 'off', label: 'כבוי' },
                      { value: 'subtle', label: 'עדין' },
                      { value: 'full', label: 'מלא' },
                    ]}
                    value={get('prCelebrationIntensity') || 'full'}
                    onChange={(v) => onUpdateSetting('prCelebrationIntensity', v)}
                  />
                  <Toggle
                    label="עקוב אחרי נפח"
                    description="עקוב גם אחרי שיאי נפח"
                    value={get('trackVolumeRecords') ?? true}
                    onChange={(v) => onUpdateSetting('trackVolumeRecords', v)}
                  />
                  <Divider />

                  <SectionHeader title="מצב חדר כושר" />
                  <Toggle
                    label="Gym Mode"
                    description="ממשק מסך מלא לחדר כושר"
                    value={get('gymModeEnabled') ?? false}
                    onChange={(v) => onUpdateSetting('gymModeEnabled', v)}
                  />
                  {get('gymModeEnabled') && (
                    <Toggle
                      label="נעילה אוטומטית"
                      description="מנע לחיצות בטעות"
                      value={get('gymModeAutoLock') ?? false}
                      onChange={(v) => onUpdateSetting('gymModeAutoLock', v)}
                    />
                  )}
                  <Divider />

                  <SectionHeader title="כפתורים מהירים" />
                  <Toggle
                    label="כפתורי משקל"
                    description="הצג +/- לשינוי משקל מהיר"
                    value={get('enableQuickWeightButtons') ?? true}
                    onChange={(v) => onUpdateSetting('enableQuickWeightButtons', v)}
                  />
                  {get('enableQuickWeightButtons') && (
                    <SliderSetting
                      label="קפיצת משקל"
                      value={get('quickWeightIncrement') ?? 2.5}
                      min={0.5}
                      max={10}
                      step={0.5}
                      unit=" ק״ג"
                      onChange={(v) => onUpdateSetting('quickWeightIncrement', v)}
                    />
                  )}
                  <Toggle
                    label="כפתורי חזרות"
                    description="הצג +/- לשינוי חזרות מהיר"
                    value={get('enableQuickRepsButtons') ?? true}
                    onChange={(v) => onUpdateSetting('enableQuickRepsButtons', v)}
                  />
                  <Divider />

                  <SectionHeader title="שקילה" />
                  <Toggle
                    label="שקילה לפני אימון"
                    description="בקש משקל גוף לפני האימון"
                    value={get('promptWeightBeforeWorkout') ?? false}
                    onChange={(v) => onUpdateSetting('promptWeightBeforeWorkout', v)}
                  />
                  <Toggle
                    label="שקילה אחרי אימון"
                    description="בקש משקל גוף אחרי האימון"
                    value={get('promptWeightAfterWorkout') ?? false}
                    onChange={(v) => onUpdateSetting('promptWeightAfterWorkout', v)}
                  />
                  <Divider />

                  <SectionHeader title="נתונים ואנליטיקס" />
                  <Toggle
                    label="אנליטיקס מפורט"
                    description="עקוב אחרי נתוני אימון מפורטים"
                    value={get('enableWorkoutAnalytics') ?? true}
                    onChange={(v) => onUpdateSetting('enableWorkoutAnalytics', v)}
                  />
                  <Toggle
                    label="איזון שרירים"
                    description="הצג איזון קבוצות שרירים"
                    value={get('showMuscleGroupBalance') ?? false}
                    onChange={(v) => onUpdateSetting('showMuscleGroupBalance', v)}
                  />
                  <Toggle
                    label="ייצוא ל-CSV"
                    description="אפשר ייצוא נתוני אימון"
                    value={get('enableExportToCSV') ?? true}
                    onChange={(v) => onUpdateSetting('enableExportToCSV', v)}
                  />
                </motion.div>
              )}

              {/* LIBRARY TAB */}
              {activeTab === 'library' && (
                <motion.div
                  key="library"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="py-2"
                >
                  <ExerciseLibraryTab />
                </motion.div>
              )}

              {/* RECORDS TAB */}
              {activeTab === 'records' && (
                <motion.div
                  key="records"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="py-2"
                >
                  <PRHistoryTab />
                </motion.div>
              )}

              {/* ANALYTICS TAB */}
              {activeTab === 'analytics' && (
                <motion.div
                  key="analytics"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="py-2"
                >
                  <AnalyticsDashboard />
                </motion.div>
              )}
            </AnimatePresence>
            <div className="h-8" />
          </div>
        </motion.div>

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
