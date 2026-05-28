import { AnimatePresence, motion } from 'framer-motion';
import React, { useState, useEffect } from 'react';
import * as dataService from '../../services/dataService';
import type { WorkoutTemplate } from '../../types';
import { logger } from '../../utils/logger';
import { CustomDumbbellIcon } from '../icons/CustomDumbbellIcon';
import PlanEditorModal from './PlanEditorModal';
import { showToast } from './components/ui/Toast';

interface WorkoutTemplatesProps {
  onStartWorkout: (template: WorkoutTemplate) => void;
  onClose?: () => void;
  isEmbedded?: boolean;
  userTemplates?: WorkoutTemplate[];
  builtinTemplates?: WorkoutTemplate[];
}

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
      showToast(`נוקו ${removed} תרגילים כפולים`, 'success');
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

  useEffect(() => {
    if (!templateToDelete) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setTemplateToDelete(null);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [templateToDelete]);

  const estimateDuration = (template: WorkoutTemplate) => {
    const totalSets = template.exercises.reduce((sum, ex) => sum + (ex.sets?.length || 3), 0);
    const mins = totalSets * 3;
    return mins < 60 ? `${mins} דק'` : `${Math.round(mins / 60)} שעה`;
  };

  return (
    <div className={`space-y-6 ${isEmbedded ? '' : 'pb-20'}`}>
      {/* Header - Masthead Style */}
      <div
        className={`flex items-center z-10 py-4 -mx-2 px-2 gap-4 ${isEmbedded ? 'justify-end' : 'justify-between'}`}
      >
        {!isEmbedded && (
          <div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.22em',
                color: 'var(--fs-accent)',
                textTransform: 'uppercase',
              }}
            >
              §01 · תבניות
            </span>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 28,
                color: 'var(--fs-heading)',
                textTransform: 'uppercase',
                letterSpacing: '-0.01em',
                marginTop: 4,
              }}
            >
              תבניות אימון
            </h2>
          </div>
        )}

        <div className="flex gap-2">
          <motion.button
            onClick={handleCleanup}
            disabled={isCleaning}
            style={{
              padding: '10px 16px',
              background: 'transparent',
              border: '2px solid var(--fs-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--fs-heading)',
              cursor: 'pointer',
            }}
          >
            {isCleaning ? '...' : 'ניקוי'}
          </motion.button>

          {onClose && !isEmbedded && (
            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: '10px 20px',
                background: 'var(--fs-primary)',
                border: 'none',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 14,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--fs-accent)',
                cursor: 'pointer',
              }}
            >
              סגור
            </motion.button>
          )}
        </div>
      </div>

      {/* Create New Button - Editorial Style */}
      <motion.button
        onClick={handleCreateNew}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        style={{
          width: '100%',
          padding: '20px 24px',
          background: 'var(--fs-accent)',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'right',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            background: 'var(--fs-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 4V16M4 10H16"
              stroke="var(--fs-accent)"
              strokeWidth="3"
              strokeLinecap="square"
            />
          </svg>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 18,
              color: 'var(--fs-heading)',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
            }}
          >
            צור תבנית חדשה
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fs-heading)',
              opacity: 0.7,
              letterSpacing: '0.05em',
              marginTop: 4,
            }}
          >
            התאם אישית תוכנית אימונים מלאה
          </div>
        </div>
      </motion.button>

      {/* User Templates Section */}
      {userTemplates.length > 0 && (
        <div className="mb-6">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: '3px solid var(--fs-primary)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 14,
                color: 'var(--fs-heading)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              תבניות אישיות
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--fs-muted)',
                letterSpacing: '0.1em',
              }}
            >
              ({userTemplates.length})
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {userTemplates.map((template, index) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onStartWorkout(template)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onStartWorkout(template);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`תבנית: ${template.name}`}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                style={{
                  background: 'var(--fs-surface)',
                  border: '2px solid var(--fs-primary)',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'background-color 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--fs-surface-2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--fs-surface)';
                }}
              >
                {/* Header */}
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--fs-surface-2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 16,
                      color: 'var(--fs-ink)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                    }}
                  >
                    {template.name}
                  </div>
                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <motion.button
                      onClick={(e) => handleEdit(template, e)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      aria-label={`ערוך תבנית ${template.name}`}
                      style={{
                        width: 44,
                        height: 44,
                        background: 'transparent',
                        border: '2px solid var(--fs-primary)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M10 2L12 4L4 12H2V10L10 2Z"
                          stroke="var(--fs-primary)"
                          strokeWidth="1.5"
                          strokeLinejoin="miter"
                        />
                      </svg>
                    </motion.button>
                    <motion.button
                      onClick={(e) => handleDelete(template, e)}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      aria-label={`מחק תבנית ${template.name}`}
                      style={{
                        width: 44,
                        height: 44,
                        background: 'transparent',
                        border: '2px solid var(--color-delete)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 4H11V12H3V4Z" stroke="var(--color-delete)" strokeWidth="1.5" />
                        <path d="M5 4V2H9V4" stroke="var(--color-delete)" strokeWidth="1.5" />
                      </svg>
                    </motion.button>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ padding: '16px 20px' }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: 16,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 800,
                          fontSize: 24,
                          color: 'var(--fs-heading)',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {template.exercises.length}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          letterSpacing: '0.15em',
                          color: 'var(--fs-muted)',
                          textTransform: 'uppercase',
                          marginTop: 4,
                        }}
                      >
                        תרגילים
                      </div>
                    </div>
                    <div
                      style={{
                        width: 1,
                        background: 'var(--fs-surface-2)',
                      }}
                    />
                    <div style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 800,
                          fontSize: 24,
                          color: 'var(--fs-accent)',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {estimateDuration(template)}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          letterSpacing: '0.15em',
                          color: 'var(--fs-muted)',
                          textTransform: 'uppercase',
                          marginTop: 4,
                        }}
                      >
                        משך
                      </div>
                    </div>
                  </div>

                  {/* Muscle Groups */}
                  {template.muscleGroups && template.muscleGroups.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {template.muscleGroups.slice(0, 3).map((muscle) => (
                        <span
                          key={muscle}
                          style={{
                            padding: '4px 10px',
                            background: 'var(--fs-surface-2)',
                            border: '1px solid var(--fs-primary)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            color: 'var(--fs-heading)',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {muscle}
                        </span>
                      ))}
                      {template.muscleGroups.length > 3 && (
                        <span
                          style={{
                            padding: '4px 10px',
                            background: 'transparent',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            color: 'var(--fs-muted)',
                          }}
                        >
                          +{template.muscleGroups.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Ribbon */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    background: 'var(--fs-primary)',
                    padding: '4px 10px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.2em',
                    color: 'var(--fs-accent)',
                    textTransform: 'uppercase',
                  }}
                >
                  אישי
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Built-in Templates Section */}
      {builtinTemplates.length > 0 && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: '3px solid var(--fs-accent)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 14,
                color: 'var(--fs-heading)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              תבניות מוכנות
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--fs-muted)',
                letterSpacing: '0.1em',
              }}
            >
              ({builtinTemplates.length})
            </span>
            <span
              style={{
                padding: '4px 8px',
                background: 'var(--fs-accent)',
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                color: 'var(--fs-heading)',
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
              }}
            >
              ★
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {builtinTemplates.map((template, index) => (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onStartWorkout(template)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onStartWorkout(template);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`תבנית: ${template.name}`}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                style={{
                  background: 'var(--fs-accent)',
                  border: '2px solid var(--fs-primary)',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'filter 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'brightness(0.95)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'none';
                }}
              >
                {/* Header with Icon */}
                <div
                  style={{
                    padding: '20px',
                    borderBottom: '1px solid var(--fs-primary)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 800,
                        fontSize: 18,
                        color: 'var(--fs-heading)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {template.name}
                    </div>
                  </div>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      background: 'var(--fs-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CustomDumbbellIcon className="w-6 h-6" style={{ color: 'var(--fs-accent)' }} />
                  </div>
                </div>

                {/* Stats */}
                <div style={{ padding: '16px 20px' }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: 16,
                      marginBottom: 12,
                    }}
                  >
                    <div style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 800,
                          fontSize: 24,
                          color: 'var(--fs-heading)',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {template.exercises.length}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          letterSpacing: '0.15em',
                          color: 'var(--fs-heading)',
                          opacity: 0.7,
                          textTransform: 'uppercase',
                          marginTop: 4,
                        }}
                      >
                        תרגילים
                      </div>
                    </div>
                    <div
                      style={{
                        width: 1,
                        background: 'var(--fs-primary)',
                        opacity: 0.3,
                      }}
                    />
                    <div style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 800,
                          fontSize: 24,
                          color: 'var(--fs-heading)',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {estimateDuration(template)}
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          letterSpacing: '0.15em',
                          color: 'var(--fs-heading)',
                          opacity: 0.7,
                          textTransform: 'uppercase',
                          marginTop: 4,
                        }}
                      >
                        משך
                      </div>
                    </div>
                  </div>

                  {/* Muscle Groups */}
                  {template.muscleGroups && template.muscleGroups.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {template.muscleGroups.slice(0, 4).map((muscle) => (
                        <span
                          key={muscle}
                          style={{
                            padding: '4px 10px',
                            background: 'var(--fs-primary)',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            color: 'var(--fs-accent)',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {muscle}
                        </span>
                      ))}
                      {template.muscleGroups.length > 4 && (
                        <span
                          style={{
                            padding: '4px 10px',
                            background: 'transparent',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            color: 'var(--fs-heading)',
                            opacity: 0.7,
                          }}
                        >
                          +{template.muscleGroups.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick Start Label */}
                <div
                  style={{
                    padding: '8px 20px',
                    background: 'var(--fs-primary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.15em',
                    color: 'var(--fs-accent)',
                    textTransform: 'uppercase',
                  }}
                >
                  התחל מיידית
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {userTemplates.length === 0 && builtinTemplates.length === 0 && (
        <div className="text-center py-12">
          <div
            style={{
              width: 80,
              height: 80,
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--fs-surface-2)',
              border: '2px solid var(--fs-primary)',
              fontSize: 32,
              color: 'var(--fs-accent)',
            }}
          >
            §
          </div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 18,
              color: 'var(--fs-ink)',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            אין תבניות עדיין
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fs-muted)',
              letterSpacing: '0.05em',
            }}
          >
            צור תבנית חדשה או השתמש בתבניות מוכנות
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {templateToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={cancelDelete}
            role="dialog"
            aria-modal="true"
            aria-labelledby="template-delete-title"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 12000,
              background: 'rgba(11,26,43,0.6)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 360,
                background: 'var(--fs-surface)',
                border: '2px solid var(--fs-primary)',
                padding: 24,
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  margin: '0 auto 16px',
                  background: 'rgba(196,43,43,0.1)',
                  border: '2px solid var(--color-delete)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M7 8H21V22H7V8Z" stroke="var(--color-delete)" strokeWidth="2" />
                  <path d="M11 8V6H17V8" stroke="var(--color-delete)" strokeWidth="2" />
                </svg>
              </div>
              <h3
                id="template-delete-title"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 20,
                  color: 'var(--fs-ink)',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                למחוק תבנית?
              </h3>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 15,
                  color: 'var(--fs-muted)',
                  marginBottom: 24,
                }}
              >
                {templateToDelete.name}
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <motion.button
                  onClick={cancelDelete}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    flex: 1,
                    padding: '16px 20px',
                    background: 'transparent',
                    border: '2px solid var(--fs-primary)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 14,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--fs-heading)',
                    cursor: 'pointer',
                  }}
                >
                  ביטול
                </motion.button>
                <motion.button
                  onClick={confirmDelete}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    flex: 1,
                    padding: '16px 20px',
                    background: 'var(--fs-warn)',
                    border: 'none',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 14,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
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
