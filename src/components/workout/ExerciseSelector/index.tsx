// ExerciseSelector - Sport Annual Editorial Design
// Navy masthead · Bone body · Sharp corners · Big Shoulders Display
// VISION: Bold · Editorial · Confident · Narrative · Printed

import { AnimatePresence, type PanInfo, motion, useMotionValue, useTransform } from 'framer-motion';
import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import * as dataService from '../../../services/dataService';
import { getWorkoutTemplates } from '../../../services/dataService';
import {
  type Exercise,
  type PersonalExercise,
  type WorkoutGoal,
  type WorkoutTemplate,
  createWorkoutSet,
} from '../../../types';
import { triggerHaptic } from '../../../utils/haptics';
import { CloseIcon, DumbbellIcon } from '../../icons';
import { ModalOverlay } from '../../ui/ModalOverlay';
import ExerciseLibraryTab from '../ExerciseLibraryTab';
import WorkoutTemplates from '../WorkoutTemplates';

const makeExerciseId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `ex-${crypto.randomUUID()}`
    : `ex-${Date.now()}-${Math.random().toString(16).slice(2)}`;

interface ExerciseSelectorProps {
  isOpen: boolean;
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
  onCreateNew: () => void;
  goal?: WorkoutGoal;
}

const ExerciseSelector: React.FC<ExerciseSelectorProps> = ({
  isOpen,
  onSelect,
  onClose,
  onCreateNew: _onCreateNew,
  goal: _goal,
}) => {
  const [_userTemplates, setUserTemplates] = useState<WorkoutTemplate[]>([]);
  const [_builtinTemplates, setBuiltinTemplates] = useState<WorkoutTemplate[]>([]);
  const [activeTab, setActiveTab] = useState<'exercises' | 'templates'>('exercises');
  const [selectedExercises, setSelectedExercises] = useState<Set<string>>(new Set());
  const [pendingExercises, setPendingExercises] = useState<PersonalExercise[]>([]);

  const y = useMotionValue(0);
  const sheetScale = useTransform(y, [0, 300], [1, 0.95]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const allTemplates = await getWorkoutTemplates();
      const userT = allTemplates.filter((t) => !t.isBuiltin);
      const builtinT = allTemplates.filter((t) => t.isBuiltin);
      setUserTemplates(userT);
      setBuiltinTemplates(builtinT);
    } catch {
      // silently handle
    }
  };

  const handleSelect = useCallback((personalExercise: PersonalExercise) => {
    if (!personalExercise.name?.trim()) return;
    triggerHaptic('light');

    setSelectedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(personalExercise.id)) {
        next.delete(personalExercise.id);
      } else {
        next.add(personalExercise.id);
      }
      return next;
    });

    setPendingExercises((prev) => {
      const exists = prev.find((e) => e.id === personalExercise.id);
      if (exists) return prev.filter((e) => e.id !== personalExercise.id);
      return [...prev, personalExercise];
    });
  }, []);

  const handleConfirmSelection = useCallback(() => {
    if (pendingExercises.length === 0) return;
    triggerHaptic('success');

    pendingExercises.forEach((personalExercise) => {
      const exercise: Exercise = {
        id: makeExerciseId(),
        name: personalExercise.name,
        muscleGroup: personalExercise.muscleGroup,
        targetRestTime: personalExercise.defaultRestTime || 90,
        sets: Array(personalExercise.defaultSets || 4)
          .fill(null)
          .map(() => createWorkoutSet({ reps: 0, weight: 0 })),
      };
      dataService.incrementExerciseUse(personalExercise.id).catch(() => {});
      onSelect(exercise);
    });

    setSelectedExercises(new Set());
    setPendingExercises([]);
    onClose();
  }, [pendingExercises, onSelect, onClose]);

  const handleTemplateSelect = useCallback(
    (template: WorkoutTemplate) => {
      if (!template.exercises || template.exercises.length === 0) return;
      triggerHaptic('success');

      template.exercises.forEach((ex) => {
        const exercise: Exercise = {
          id: makeExerciseId(),
          name: ex.name,
          muscleGroup: ex.muscleGroup,
          targetRestTime: ex.targetRestTime || 90,
          sets:
            ex.sets && ex.sets.length > 0
              ? ex.sets.map((s) => createWorkoutSet({ reps: s.reps || 0, weight: s.weight || 0 }))
              : Array(4)
                  .fill(null)
                  .map(() => createWorkoutSet({ reps: 0, weight: 0 })),
        };
        onSelect(exercise);
      });

      setSelectedExercises(new Set());
      setPendingExercises([]);
      onClose();
    },
    [onSelect, onClose]
  );

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 150) onClose();
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      variant="none"
      zLevel="extreme"
      backdropOpacity={60}
      blur="none"
      trapFocus
      lockScroll={false}
      closeOnBackdropClick
      closeOnEscape
      ariaLabel="בחירת תרגילים"
    >
      <motion.div
        className="fixed bottom-0 left-0 right-0 flex flex-col"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{ scale: sheetScale, y, maxHeight: '90dvh' }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={handleDragEnd}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── NAVY MASTHEAD ── */}
        <div style={{ background: 'var(--navy)' }}>
          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div
              className="w-10 h-1 rounded-full"
              style={{ background: 'rgba(var(--text-on-navy-rgb),0.3)' }}
            />
          </div>

          {/* Header */}
          <div className="px-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <h1
                  className="uppercase"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 900,
                    fontSize: 28,
                    color: 'var(--bone)',
                    letterSpacing: '-0.01em',
                    lineHeight: 0.95,
                    direction: 'ltr',
                    textAlign: 'left',
                  }}
                >
                  בחר תרגילים
                </h1>
                <p
                  className="mt-1"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.15em',
                    color: 'rgba(var(--text-on-navy-rgb),0.5)',
                    textTransform: 'uppercase',
                  }}
                >
                  ספריית תרגילים
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-11 h-11 flex items-center justify-center transition-colors cursor-pointer"
                style={{
                  background: 'rgba(var(--text-on-navy-rgb),0.1)',
                  borderRadius: 0,
                }}
                aria-label="סגור"
              >
                <CloseIcon className="w-5 h-5" style={{ color: 'var(--bone)' }} />
              </button>
            </div>

            {/* Tabs — Apple Segmented */}
            <div
              className="mt-4 grid grid-cols-2 gap-0"
              style={{ background: 'rgba(var(--text-on-navy-rgb),0.08)' }}
            >
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setActiveTab('exercises');
                }}
                aria-current={activeTab === 'exercises' ? 'page' : undefined}
                className="py-2.5 min-h-[44px] text-sm font-bold text-center transition-all cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-mustard focus-visible:outline-offset-[-2px]"
                style={{
                  background: activeTab === 'exercises' ? 'var(--mustard)' : 'transparent',
                  color:
                    activeTab === 'exercises'
                      ? 'var(--color-on-mustard)'
                      : 'rgba(var(--text-on-navy-rgb),0.65)',
                  fontFamily: 'var(--font-display)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  borderRadius: 0,
                }}
              >
                תרגילים
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('selection');
                  setActiveTab('templates');
                }}
                aria-current={activeTab === 'templates' ? 'page' : undefined}
                className="py-2.5 min-h-[44px] text-sm font-bold text-center transition-all cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-mustard focus-visible:outline-offset-[-2px]"
                style={{
                  background: activeTab === 'templates' ? 'var(--mustard)' : 'transparent',
                  color:
                    activeTab === 'templates'
                      ? 'var(--color-on-mustard)'
                      : 'rgba(var(--text-on-navy-rgb),0.65)',
                  fontFamily: 'var(--font-display)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  borderRadius: 0,
                }}
              >
                תבניות
              </button>
            </div>
          </div>
        </div>

        {/* ── BONE BODY ── */}
        <div
          className="flex-1 relative flex flex-col overflow-hidden"
          style={{ background: 'var(--bone)' }}
        >
          {activeTab === 'exercises' ? (
            <div className="flex-1 flex flex-col overflow-y-auto -webkit-overflow-scrolling-touch">
              <ExerciseLibraryTab
                isSelectionMode={true}
                onSelect={handleSelect}
                selectedIds={selectedExercises}
              />
            </div>
          ) : (
            <div className="pt-4 px-5 h-full overflow-y-auto">
              <WorkoutTemplates onStartWorkout={handleTemplateSelect} isEmbedded={true} />
            </div>
          )}
        </div>

        {/* ── FOOTER CTA ── */}
        <AnimatePresence>
          {pendingExercises.length > 0 ? (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="px-5 py-4"
              style={{
                background: 'var(--bone)',
                borderTop: '2px solid var(--navy)',
              }}
            >
              <button
                type="button"
                onClick={handleConfirmSelection}
                className="w-full flex items-center justify-center gap-3 cursor-pointer"
                style={{
                  background: 'var(--navy)',
                  color: 'var(--mustard)',
                  borderRadius: 0,
                  padding: '18px 24px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 16,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  minHeight: 56,
                }}
                aria-label={`התחל אימון עם ${pendingExercises.length} תרגילים`}
              >
                <DumbbellIcon style={{ width: 20, height: 20, flexShrink: 0 }} />
                התחל ({pendingExercises.length})
              </button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-5 py-4"
              style={{
                background: 'var(--bone)',
                borderTop: '1px solid var(--bone-deep)',
              }}
            >
              <button
                type="button"
                onClick={onClose}
                className="w-full cursor-pointer"
                style={{
                  background: 'transparent',
                  color: 'var(--stone)',
                  border: '2px solid var(--bone-deep)',
                  borderRadius: 0,
                  padding: '14px 24px',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 13,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  minHeight: 48,
                }}
              >
                חזרה לאימון
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Safe area bottom */}
        <div style={{ height: 'env(safe-area-inset-bottom, 8px)', background: 'var(--bone)' }} />
      </motion.div>
    </ModalOverlay>
  );
};

export default ExerciseSelector;
