// WorkoutStartModal - VISION Sport Annual Editorial Design
// Navy · Mustard · Bone · Big Shoulders Display + IBM Plex Mono

import { motion } from 'framer-motion';
import React, { useState, useEffect } from 'react';
import * as dataService from '../../services/dataService';
import type { PersonalExercise, WorkoutSession, WorkoutTemplate } from '../../types';
import { triggerHaptic } from '../../utils/haptics';
import { logger } from '../../utils/logger';
import { ModalOverlay } from '../ui/ModalOverlay';
import WorkoutTemplates from './WorkoutTemplates';

interface WorkoutStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartFromTemplate: (template: WorkoutTemplate) => void;
  onStartEmpty: () => void;
  onRepeatLastWorkout: (session: WorkoutSession) => void;
  onOpenHistory?: () => void;
}

const WorkoutStartModal: React.FC<WorkoutStartModalProps> = ({
  isOpen,
  onClose,
  onStartFromTemplate,
  onStartEmpty,
  onRepeatLastWorkout,
  onOpenHistory,
}) => {
  const [lastSession, setLastSession] = useState<WorkoutSession | null>(null);
  const [mostUsedExercises, setMostUsedExercises] = useState<PersonalExercise[]>([]);
  const [activeTab, setActiveTab] = useState<'templates' | 'quick'>('templates');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const sessions = await dataService.getWorkoutSessions(1);
      if (sessions.length > 0 && sessions[0]) {
        setLastSession(sessions[0]);
      }

      const exercises = await dataService.getPersonalExercises();
      const topExercises = exercises.filter((ex) => (ex.useCount || 0) > 0).slice(0, 6);
      setMostUsedExercises(topExercises);
    } catch (error) {
      logger.workout.error('Failed to load workout start data', error);
    } finally {
      setLoading(false);
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'היום';
    if (diffDays === 1) return 'אתמול';
    if (diffDays < 7) return `לפני ${diffDays} ימים`;
    return `לפני ${Math.floor(diffDays / 7)} שבועות`;
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      variant="modal"
      zLevel="extreme"
      backdropOpacity={60}
      blur="sm"
      trapFocus
      lockScroll
      closeOnBackdropClick
      closeOnEscape
      ariaLabel="התחל אימון"
    >
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: 480,
          margin: '0 auto',
          background: 'var(--bone)',
          maxHeight: '90dvh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          borderTop: '2px solid var(--navy)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 20px 16px',
            borderBottom: '1px solid var(--bone-deep)',
          }}
        >
          {/* Header Row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.22em',
                  color: 'var(--mustard)',
                  textTransform: 'uppercase',
                }}
              >
                §01 · אימון
              </span>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: 24,
                  color: 'var(--navy)',
                  textTransform: 'uppercase',
                  letterSpacing: '-0.01em',
                  marginTop: 4,
                }}
              >
                התחל אימון
              </h2>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {onOpenHistory && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenHistory();
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenHistory();
                  }}
                  style={{
                    width: 44,
                    height: 44,
                    background: 'transparent',
                    border: '2px solid var(--navy)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                  aria-label="היסטוריה"
                >
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <circle cx="9" cy="9" r="7" stroke="var(--navy)" strokeWidth="1.5" />
                    <path d="M9 5V9L11.5 11.5" stroke="var(--navy)" strokeWidth="1.5" strokeLinecap="square" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onClose();
                }}
                style={{
                  width: 44,
                  height: 44,
                  background: 'var(--navy)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
                aria-label="סגור"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M5 5L13 13M13 5L5 13" stroke="var(--mustard)" strokeWidth="2" strokeLinecap="square" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs - Editorial Segmented Control */}
          <div
            style={{
              display: 'flex',
              background: 'var(--bone-deep)',
              padding: 4,
            }}
          >
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setActiveTab('templates');
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                triggerHaptic('selection');
                setActiveTab('templates');
              }}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: activeTab === 'templates' ? 'var(--navy)' : 'transparent',
                border: 'none',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 14,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: activeTab === 'templates' ? 'var(--mustard)' : 'var(--stone)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              תבניות
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic('selection');
                setActiveTab('quick');
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                triggerHaptic('selection');
                setActiveTab('quick');
              }}
              style={{
                flex: 1,
                padding: '10px 16px',
                background: activeTab === 'quick' ? 'var(--navy)' : 'transparent',
                border: 'none',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 14,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: activeTab === 'quick' ? 'var(--mustard)' : 'var(--stone)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
            >
              התחלה מהירה
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 16,
            paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))',
          }}
        >
          {loading ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 48,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  border: '3px solid var(--navy)',
                  borderTopColor: 'transparent',
                  animation: 'spin 1s linear infinite',
                }}
              />
            </div>
          ) : activeTab === 'templates' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Repeat Last Workout */}
              {lastSession && (
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => {
                    triggerHaptic('medium');
                    onRepeatLastWorkout(lastSession);
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    triggerHaptic('medium');
                    onRepeatLastWorkout(lastSession);
                  }}
                  style={{
                    width: '100%',
                    padding: 16,
                    background: 'var(--mustard)',
                    border: '2px solid var(--navy)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    cursor: 'pointer',
                    textAlign: 'right',
                    transition: 'filter 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.filter = 'brightness(0.95)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.filter = 'none';
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      background: 'var(--navy)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 24,
                      flexShrink: 0,
                      color: 'var(--mustard)',
                    }}
                  >
                    §
                  </div>
                  <div style={{ flex: 1 }}>
                    <h3
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 800,
                        fontSize: 16,
                        color: 'var(--navy)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                      }}
                    >
                      חזור על אימון אחרון
                    </h3>
                    <p
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        color: 'var(--navy)',
                        opacity: 0.7,
                        letterSpacing: '0.05em',
                        marginTop: 4,
                      }}
                    >
                      {lastSession.exercises.length} תרגילים · {formatRelativeTime(lastSession.startTime)}
                    </p>
                  </div>
                </motion.button>
              )}

              {/* Templates Component */}
              <div style={{ paddingTop: 8 }}>
                <WorkoutTemplates
                  onStartWorkout={(t) => {
                    onStartFromTemplate(t);
                  }}
                  isEmbedded={true}
                />
              </div>
            </div>
          ) : (
            /* Quick Start Tab */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic('medium');
                  onStartEmpty();
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  triggerHaptic('medium');
                  onStartEmpty();
                }}
                style={{
                  width: '100%',
                  padding: 20,
                  background: 'var(--navy)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  cursor: 'pointer',
                  textAlign: 'right',
                  transition: 'background 150ms ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--navy-deep)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'var(--navy)';
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    background: 'var(--mustard)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5V19M5 12H19" stroke="var(--navy)" strokeWidth="3" strokeLinecap="square" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <h3
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 18,
                      color: 'var(--mustard)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    התחל אימון ריק
                  </h3>
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'rgba(var(--text-on-navy-rgb),0.6)',
                      letterSpacing: '0.05em',
                      marginTop: 4,
                    }}
                  >
                    בחר תרגילים תוך כדי תנועה
                  </p>
                </div>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M8 5L13 10L8 15" stroke="var(--mustard)" strokeWidth="2" strokeLinecap="square" />
                </svg>
              </motion.button>

              {/* Most Used Exercises */}
              {mostUsedExercises.length > 0 && (
                <div style={{ paddingTop: 16 }}>
                  <h3
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.2em',
                      color: 'var(--stone)',
                      textTransform: 'uppercase',
                      marginBottom: 12,
                      paddingRight: 4,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span style={{ color: 'var(--mustard)' }}>§</span>
                    הכי בשימוש
                  </h3>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 12,
                    }}
                  >
                    {mostUsedExercises.map((exercise) => (
                      <div
                        key={exercise.id}
                        style={{
                          padding: 12,
                          background: 'var(--bone-deep)',
                          border: '2px solid var(--navy)',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 800,
                            fontSize: 13,
                            color: 'var(--navy)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.02em',
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {exercise.name}
                        </span>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            color: 'var(--stone)',
                            letterSpacing: '0.05em',
                            marginTop: 4,
                            display: 'block',
                          }}
                        >
                          {exercise.useCount || 0} פעמים
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </ModalOverlay>
  );
};

export default React.memo(WorkoutStartModal);
