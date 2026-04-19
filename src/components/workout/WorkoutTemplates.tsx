import { AnimatePresence, motion } from 'framer-motion';
import React, { useState, useEffect } from 'react';
import * as dataService from '../../services/dataService';
import type { WorkoutTemplate } from '../../types';
import { logger } from '../../utils/logger';
import { AddIcon, PlayIcon, StarIcon, TrashIcon } from '../icons';
import PlanEditorModal from './PlanEditorModal';
import { showToast } from './components/ui/Toast';

interface WorkoutTemplatesProps {
  onStartWorkout: (template: WorkoutTemplate) => void;
  onClose?: () => void;
  isEmbedded?: boolean;
  userTemplates?: WorkoutTemplate[];
  builtinTemplates?: WorkoutTemplate[];
}

// Local Edit Icon
const EditIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
);

// Get icon for built-in templates
const getBuiltinTemplateIcon = (templateName: string): string => {
  const iconMap: Record<string, string> = {
    'אימון כללי': '💪',
    'חזה + כתפיים': '🦅',
    'גב + זרועות': '🏋️',
    רגליים: '🦵',
    'בטן + ליבה': '🔥',
  };
  return iconMap[templateName] || '⚡';
};

const WorkoutTemplates: React.FC<WorkoutTemplatesProps> = ({
  onStartWorkout,
  onClose,
  isEmbedded = false,
  userTemplates: userTemplatesProp,
  builtinTemplates: builtinTemplatesProp,
}) => {
  const [userTemplates, setUserTemplates] = useState<WorkoutTemplate[]>([]);
  const [builtinTemplates, setBuiltinTemplates] = useState<WorkoutTemplate[]>([]);
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<WorkoutTemplate | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  // Update when props change
  useEffect(() => {
    if (userTemplatesProp) {
      setUserTemplates(userTemplatesProp);
    }
    if (builtinTemplatesProp) {
      setBuiltinTemplates(builtinTemplatesProp);
    }
  }, [userTemplatesProp, builtinTemplatesProp]);

  const loadTemplates = async () => {
    await dataService.initializeBuiltInWorkoutTemplates();
    const allData = await dataService.getWorkoutTemplates();

    // Use prop values if available, otherwise use loaded data
    const userT = userTemplatesProp || allData.filter((t) => !t.isBuiltin);
    const builtinT = builtinTemplatesProp || allData.filter((t) => t.isBuiltin);

    setUserTemplates(userT);
    setBuiltinTemplates(builtinT);
  };

  const handleCreateNew = () => {
    setEditingTemplate(null);
    setShowPlanEditor(true);
  };

  const handleEdit = (template: WorkoutTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTemplate(template);
    setShowPlanEditor(true);
  };

  const handleSavePlan = async (planData: Partial<WorkoutTemplate>) => {
    if (editingTemplate) {
      await dataService.updateWorkoutTemplate(editingTemplate.id, planData);
    } else {
      await dataService.createWorkoutTemplate({
        name: planData.name || 'New Plan',
        description: planData.description || '',
        exercises: planData.exercises || [],
        muscleGroups: planData.muscleGroups || [],
        lastUsed: null,
        timesUsed: 0,
        isFavorite: false,
        isBuiltin: false,
        updatedAt: new Date().toISOString(),
      });
    }
    setShowPlanEditor(false);
    loadTemplates();
  };

  const handleCleanup = async () => {
    if (!window.confirm('האם לאחד תרגילים כפולים בספרייה?')) return;
    setIsCleaning(true);
    try {
      const removed = await dataService.removeDuplicateExercises();
      showToast(`נוקו ${removed} תרגילים כפולים!`, 'success');
    } catch (e) {
      logger.workout.error('WorkoutTemplates error', e);
      showToast('שגיאה בניקוי', 'error');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleDelete = (template: WorkoutTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    setTemplateToDelete(template);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;
    await dataService.deleteWorkoutTemplate(templateToDelete.id);
    setTemplateToDelete(null);
    loadTemplates();
  };

  const cancelDelete = () => {
    setTemplateToDelete(null);
  };

  // Estimate workout duration (avg 3 min per set)
  const estimateDuration = (template: WorkoutTemplate) => {
    const totalSets = template.exercises.reduce((sum, ex) => sum + (ex.sets?.length || 3), 0);
    const mins = totalSets * 3;
    return mins < 60 ? `${mins} דק'` : `${Math.round(mins / 60)} שעה`;
  };

  return (
    <div className={`space-y-6 ${isEmbedded ? '' : 'pb-20'}`}>
      {/* Header */}
      <div
        className={`flex items-center z-10 py-4 -mx-2 px-2 gap-4 ${isEmbedded ? 'justify-end' : 'justify-between sticky top-0 bg-gradient-to-b from-[var(--bg-primary)] via-[var(--bg-primary)] to-transparent backdrop-blur-xl'}`}
      >
        {!isEmbedded && (
          <div>
            <h2 className="text-2xl font-black workout-gradient-text-accent">תבניות אימון</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">בחר תבנית להתחלה מהירה</p>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleCleanup}
            onPointerDown={(e) => {
              e.preventDefault();
              handleCleanup();
            }}
            disabled={isCleaning}
            className="px-3 py-2.5 bg-white/5 text-white/50 hover:text-white rounded-xl font-medium text-xs transition-colors"
          >
            {isCleaning ? '...' : 'ניקוי כפילויות'}
          </button>

          {onClose && !isEmbedded && (
            <motion.button
              onClick={onClose}
              onPointerDown={(e) => {
                e.preventDefault();
                onClose();
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-4 py-2.5 bg-white/5 border border-white/10 text-white rounded-xl font-semibold hover:bg-white/10 transition-all"
            >
              סגור
            </motion.button>
          )}
        </div>
      </div>

      {/* Plan Editor Logic Replaces the Inline Form */}

      {/* Create New Button (Prominent) */}
      <motion.button
        onClick={handleCreateNew}
        onPointerDown={(e) => {
          e.preventDefault();
          handleCreateNew();
        }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="w-full h-20 rounded-2xl border border-dashed border-white/20 hover:border-[var(--cosmos-accent-primary)] hover:bg-[var(--cosmos-accent-primary)]/5 flex items-center justify-center gap-3 group transition-all mb-2"
      >
        <div className="w-10 h-10 rounded-full bg-white/5 group-hover:bg-[var(--cosmos-accent-primary)] group-hover:text-black flex items-center justify-center transition-colors text-white/50">
          <AddIcon className="w-5 h-5" />
        </div>
        <div className="flex flex-col items-start">
          <span className="font-bold text-lg text-white group-hover:text-[var(--cosmos-accent-primary)] transition-colors">
            צור תבנית חדשה
          </span>
          <span className="text-xs text-white/40">התאם אישית תוכנית אימונים מלאה</span>
        </div>
      </motion.button>

      {/* User Templates Section */}
      {userTemplates.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-white/70">תבניות אישיות</span>
            <span className="text-xs text-white/40">({userTemplates.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {userTemplates.map((template, index) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onStartWorkout(template)}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onStartWorkout(template);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onStartWorkout(template);
                  }
                }}
                className="workout-template-card relative overflow-hidden rounded-2xl cursor-pointer group"
                role="button"
                tabIndex={0}
                aria-label={`תבנית: ${template.name}`}
              >
                {/* Card Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-white/[0.02]" />

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-[var(--cosmos-accent-primary)]/0 group-hover:bg-[var(--cosmos-accent-primary)]/5 transition-colors duration-300" />

                {/* Decorative Corner */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[var(--cosmos-accent-primary)]/10 to-transparent rounded-bl-[100%] -mr-8 -mt-8 opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Card Border */}
                <div className="absolute inset-0 rounded-2xl border border-white/10 group-hover:border-white/20 transition-colors" />

                {/* Content */}
                <div className="relative z-10 p-5">
                  {/* Header Row */}
                  <div className="flex justify-between items-start mb-4">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="p-3 rounded-xl bg-white/5"
                    >
                      <PlayIcon className="w-6 h-6 text-white/70" />
                    </motion.div>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <motion.button
                        onClick={(e) => handleEdit(template, e)}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          handleEdit(template, e as unknown as React.MouseEvent);
                        }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="p-2 rounded-lg bg-white/10 text-white hover:bg-[var(--cosmos-accent-primary)] hover:text-black transition-colors"
                      >
                        <EditIcon className="w-4 h-4" />
                      </motion.button>
                      <motion.button
                        onClick={(e) => handleDelete(template, e)}
                        onPointerDown={(e) => {
                          e.preventDefault();
                          handleDelete(template, e as unknown as React.MouseEvent);
                        }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </motion.button>
                    </div>
                  </div>

                  {/* Template Name */}
                  <h3 className="text-lg font-bold text-white mb-2 line-clamp-1 group-hover:text-[var(--cosmos-accent-primary)] transition-colors">
                    {template.name}
                  </h3>

                  {/* Stats Row */}
                  <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)] mb-3">
                    <span className="flex items-center gap-1">
                      <span className="text-[var(--cosmos-accent-primary)]">
                        {template.exercises.length}
                      </span>
                      תרגילים
                    </span>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span>{estimateDuration(template)}</span>
                  </div>

                  {/* Muscle Groups */}
                  {template.muscleGroups && template.muscleGroups.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {template.muscleGroups.slice(0, 3).map((muscle) => (
                        <span
                          key={muscle}
                          className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-white/60 font-medium"
                        >
                          {muscle}
                        </span>
                      ))}
                      {template.muscleGroups.length > 3 && (
                        <span className="px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-white/40">
                          +{template.muscleGroups.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Type Badge */}
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold tracking-wide bg-white/5 text-white/50">
                    👤 אישי
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Built-in Templates Section */}
      {builtinTemplates.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-[var(--cosmos-accent-primary)]">
              תבניות מוכנות
            </span>
            <span className="text-xs text-white/40">({builtinTemplates.length})</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--cosmos-accent-primary)]/10 text-[var(--cosmos-accent-primary)]">
              ⭐
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {builtinTemplates.map((template, index) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onStartWorkout(template)}
                onPointerDown={(e) => {
                  e.preventDefault();
                  onStartWorkout(template);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onStartWorkout(template);
                  }
                }}
                className="workout-template-card relative overflow-hidden rounded-2xl cursor-pointer group"
                role="button"
                tabIndex={0}
                aria-label={`תבנית: ${template.name}`}
              >
                {/* Card Background - Gradient for built-in */}
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--cosmos-accent-primary)]/10 via-transparent to-[var(--cosmos-accent-cyan)]/5" />

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-[var(--cosmos-accent-primary)]/0 group-hover:bg-[var(--cosmos-accent-primary)]/10 transition-colors duration-300" />

                {/* Decorative Corner */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[var(--cosmos-accent-primary)]/20 to-transparent rounded-bl-[100%] -mr-8 -mt-8 opacity-0 group-hover:opacity-100 transition-opacity" />

                {/* Card Border */}
                <div className="absolute inset-0 rounded-2xl border border-[var(--cosmos-accent-primary)]/20 group-hover:border-[var(--cosmos-accent-primary)]/40 transition-colors" />

                {/* Content */}
                <div className="relative z-10 p-5">
                  {/* Header Row */}
                  <div className="flex justify-between items-start mb-4">
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      className="p-3 rounded-xl bg-gradient-to-br from-[var(--cosmos-accent-primary)]/20 to-[var(--cosmos-accent-primary)]/5"
                    >
                      <span className="text-2xl">{getBuiltinTemplateIcon(template.name)}</span>
                    </motion.div>

                    {/* Built-in Badge */}
                    <div className="px-2.5 py-1 rounded-lg bg-[var(--cosmos-accent-primary)]/10 text-[10px] text-[var(--cosmos-accent-primary)] font-bold flex items-center gap-1">
                      <StarIcon className="w-3 h-3" />
                      מובנה
                    </div>
                  </div>

                  {/* Template Name */}
                  <h3 className="text-lg font-bold text-white mb-2 line-clamp-1 group-hover:text-[var(--cosmos-accent-primary)] transition-colors">
                    {template.name}
                  </h3>

                  {/* Stats Row */}
                  <div className="flex items-center gap-3 text-sm text-[var(--text-secondary)] mb-3">
                    <span className="flex items-center gap-1">
                      <span className="text-[var(--cosmos-accent-primary)]">
                        {template.exercises.length}
                      </span>
                      תרגילים
                    </span>
                    <span className="w-1 h-1 rounded-full bg-white/20" />
                    <span>{estimateDuration(template)}</span>
                  </div>

                  {/* Muscle Groups */}
                  {template.muscleGroups && template.muscleGroups.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {template.muscleGroups.slice(0, 4).map((muscle) => (
                        <span
                          key={muscle}
                          className="px-2 py-0.5 rounded-full bg-[var(--cosmos-accent-primary)]/10 text-[10px] text-[var(--cosmos-accent-primary)] font-medium border border-[var(--cosmos-accent-primary)]/20"
                        >
                          {muscle}
                        </span>
                      ))}
                      {template.muscleGroups.length > 4 && (
                        <span className="px-2 py-0.5 rounded-full bg-[var(--cosmos-accent-primary)]/10 text-[10px] text-[var(--cosmos-accent-primary)]/60">
                          +{template.muscleGroups.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Quick Start Label */}
                  <div className="mt-2 text-xs text-white/50">✨ התחל מיידית</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {userTemplates.length === 0 && builtinTemplates.length === 0 && (
        <div className="text-center py-12">
          <span className="text-4xl mb-4 block">🏋️</span>
          <h3 className="text-lg font-bold text-white mb-2">אין תבניות עדיין</h3>
          <p className="text-sm text-white/50">צור תבנית חדשה או השתמש בתבניות מוכנות</p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {templateToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[12000] flex items-center justify-center p-4"
            onClick={cancelDelete}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-[var(--color-surface)]/80 backdrop-blur-md border border-white/10 rounded-3xl p-6 text-center shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
            >
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <TrashIcon className="w-8 h-8 text-red-400" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">למחוק תבנית?</h3>
              <p className="text-base text-white/80 mb-1">{templateToDelete.name}</p>
              <p className="text-sm text-white/50 mb-6">
                המחיקה תשפיע רק על התבנית, אימונים שכבר ביצעת יישארו בהיסטוריה.
              </p>
              <div className="flex gap-3">
                <motion.button
                  onClick={cancelDelete}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    cancelDelete();
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 h-12 rounded-2xl bg-white/5 border border-white/10 text-white/70 font-medium hover:bg-white/10 transition-all"
                >
                  ביטול
                </motion.button>
                <motion.button
                  onClick={confirmDelete}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    confirmDelete();
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold shadow-[0_0_20px_rgba(239,68,68,0.3)] hover:shadow-[0_0_30px_rgba(239,68,68,0.5)] transition-all"
                >
                  מחיקה
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPlanEditor && (
          <PlanEditorModal
            isOpen={showPlanEditor}
            onClose={() => setShowPlanEditor(false)}
            onSave={handleSavePlan}
            initialPlan={editingTemplate}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default React.memo(WorkoutTemplates);
