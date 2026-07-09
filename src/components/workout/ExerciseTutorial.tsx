// ExerciseTutorial - Fresh Steel / Obsidian
// Dark overlay · light text · sharp corners
// VISION: Bold · Editorial · Confident · Narrative · Printed

import { m } from 'framer-motion';
import { X as CloseIcon } from 'lucide-react';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { translateEquipment } from '../../constants/equipmentNames';
import { getExerciseImages } from '../../data/exerciseImages';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { logger } from '../../utils/logger';
import { MuscleMap } from '../fitness/MuscleMap';
import { splitInstructionSteps } from './instructionSteps';

interface ExerciseTutorialProps {
  isOpen: boolean;
  exerciseName: string;
  customNotes?: string;
  /** Primary muscle (English catalog key or Hebrew) — drives the muscle map. */
  primaryMuscle?: string;
  /** Secondary muscles for the muscle map. */
  secondaryMuscles?: string[];
  /** Equipment catalog key (e.g. "barbell") — shown as a Hebrew badge. */
  equipment?: string;
  /** The exercise's own execution cue — segmented into ordered steps. */
  instructions?: string;
  onClose: () => void;
}

interface TutorialStep {
  title: string;
  description: string;
  tip?: string;
}

const ExerciseTutorial: React.FC<ExerciseTutorialProps> = ({
  isOpen,
  exerciseName,
  customNotes,
  primaryMuscle,
  secondaryMuscles,
  equipment,
  instructions,
  onClose,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  // Track demo-image failures per index, so one broken frame hides only itself —
  // the working frame stays visible instead of the whole demonstration block.
  const [failedImgs, setFailedImgs] = useState<ReadonlySet<number>>(() => new Set());
  const [showContent, setShowContent] = useState(false);
  const [tutorialContent, setTutorialContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useFocusTrap(containerRef, { isOpen, onClose, closeOnEscape: true, lockScroll: true });

  const tutorialSteps: TutorialStep[] = useMemo(
    () => [
      { title: 'תחילת תנועה', description: `התחל את תנועת ${exerciseName} מהמצב ההתחלתי הנכון` },
      {
        title: 'טכניקה',
        description: 'בצע את התרגיל בתנועה מבוקרת וישרה',
        tip: 'שמור על שרירי הליבה מכווצים לאורך כל התנועה',
      },
      { title: 'סיום', description: 'השלם את הסט בצורה בטוחה ויציבה' },
    ],
    [exerciseName]
  );

  const exerciseTips: Record<string, TutorialStep[]> = useMemo(
    () => ({
      'Bench Press': [
        { title: 'מצב התחלתי', description: 'שכב על הספסל כשהעיניים מתחת למוט' },
        { title: 'אחיזה', description: 'אחז ברוחב כתפיים וחצי, פרקי ידיים ישרים' },
        { title: 'תנועה', description: 'הורד את המוט לאמצע החזה בשליטה' },
        { title: 'לחץ', description: 'דחף למעלה בקו ישר לכיוון הפנים' },
        {
          title: 'טיפ חשוב',
          description: 'שמור על הגב צמוד לספסל',
          tip: 'אל תנעל את המרפקים לחלוטין',
        },
      ],
      Squat: [
        { title: 'מצב התחלתי', description: 'עמוד ברוחב כתפיים, מוט על הגב העליון' },
        { title: 'עמדה', description: 'הברכיים בכיוון האצבעות, עקבים ברצפה' },
        { title: 'תנועה', description: 'רד עד שהירכיים מקבילות לרצפה' },
        { title: 'טכניקה', description: 'שמור על הגב ישר, משקל על העקבים' },
        { title: 'עלייה', description: 'דחף דרך העקבים, אל תנעל את הברכיים' },
      ],
      Deadlift: [
        { title: 'מצב התחלתי', description: 'עמוד קרוב למוט, רגליים ברוחב ירכיים' },
        { title: 'אחיזה', description: 'אחז ברוחב כתפיים, שמור על זווית ישרה בגב' },
        { title: 'תנועה', description: 'הרם עם הרגליים, שמור על הגב ישר' },
        { title: 'סיום', description: 'נעל את הירכיים, כתפיים לאחור' },
        {
          title: 'טיפ',
          description: 'אל תעגל את הגב - זו הטעות הנפוצה ביותר',
          tip: 'השתמש בחגורת אימון למשקולות כבדות',
        },
      ],
    }),
    []
  );

  // The bilingual catalog name is "Hebrew | English"; curated tips are keyed by
  // the English movement, so resolve that side for the lookup.
  const englishName = useMemo(() => {
    const idx = exerciseName.lastIndexOf('|');
    return (idx >= 0 ? exerciseName.slice(idx + 1) : exerciseName).trim();
  }, [exerciseName]);

  // Prefer curated multi-step technique; otherwise segment the exercise's own
  // cue into ordered steps (the "instruction_steps" idea applied to our Hebrew
  // tutorialText); otherwise fall back to the generic three-beat outline so the
  // carousel is never empty.
  const currentExerciseSteps = useMemo<TutorialStep[]>(() => {
    const curated = exerciseTips[englishName] ?? exerciseTips[exerciseName];
    if (curated) return curated;
    const segmented = splitInstructionSteps(instructions);
    if (segmented.length > 0) return segmented.map((description) => ({ title: '', description }));
    return tutorialSteps;
  }, [englishName, exerciseName, exerciseTips, instructions, tutorialSteps]);

  const equipmentLabel = translateEquipment(equipment);
  const hasMuscleData = Boolean(primaryMuscle || (secondaryMuscles?.length ?? 0) > 0);
  const demoImages = useMemo(() => getExerciseImages(exerciseName), [exerciseName]);
  // The (up to two) frames that haven't failed to load — preserving each frame's
  // original index so its alt text (start vs finish position) stays correct.
  const visibleDemoImages = demoImages
    .slice(0, 2)
    .map((src, i) => ({ src, i }))
    .filter(({ i }) => !failedImgs.has(i));

  useEffect(() => {
    if (exerciseName) {
      setActiveStep(0);
      setShowContent(false);
      setTutorialContent(null);
      setFailedImgs(new Set());
    }
  }, [exerciseName]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      // RTL carousel: the "הבא" (next) button sits on the LEFT and the progress
      // spine advances right-to-left, so ArrowLeft advances and ArrowRight goes
      // back — matching the visual order (WAI-ARIA RTL convention).
      if (e.key === 'ArrowLeft')
        setActiveStep((prev) => Math.min(prev + 1, currentExerciseSteps.length - 1));
      else if (e.key === 'ArrowRight') setActiveStep((prev) => Math.max(prev - 1, 0));
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentExerciseSteps.length, onClose]);

  const handleShowTips = useCallback(async () => {
    setLoading(true);
    try {
      const { getExerciseTutorial } = await import('../../services/ai');
      const tips = await getExerciseTutorial(exerciseName);
      setTutorialContent(tips);
      setShowContent(true);
    } catch (error) {
      logger.workout.error('Failed to load tips', error);
    } finally {
      setLoading(false);
    }
  }, [exerciseName]);

  // Grounded per-exercise Q&A: the answer is anchored to the user's REAL recent
  // numbers for this exercise (most-recent set + estimated 1RM) and the model is
  // told not to invent figures — so it can't hallucinate a weight (AW-2/AS-6).
  const handleAsk = useCallback(async () => {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setQaError(null);
    let humanize: (e: unknown) => string = () => 'לא הצלחתי לענות כרגע. נסה שוב.';
    try {
      const ai = await import('../../services/ai');
      const { getWorkoutSessions } = await import('../../services/dataService');
      const errMod = await import('../../services/ai/errorMessages');
      humanize = errMod.humanizeAIError;
      const sessions = await getWorkoutSessions(100);
      const grounding = ai.buildExerciseGrounding(exerciseName, sessions);
      const reply = await ai.askExerciseQuestion(exerciseName, q, { grounding });
      setAnswer(reply);
    } catch (error) {
      logger.ai.error('Exercise Q&A failed', error);
      setQaError(humanize(error));
    } finally {
      setAsking(false);
    }
  }, [question, asking, exerciseName]);

  if (!isOpen) return null;

  const currentStep = currentExerciseSteps[activeStep];

  return (
    <m.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--fs-bg)',
        zIndex: 11000,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(var(--text-on-navy-rgb),0.1)',
          background: 'var(--fs-primary)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.2em',
              color: 'var(--fs-accent)',
              textTransform: 'uppercase',
            }}
          >
            שלב {activeStep + 1}
          </div>
          <h2
            id="tutorial-title"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 20,
              color: 'var(--fs-ink)',
              letterSpacing: '-0.01em',
            }}
          >
            {exerciseName}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(var(--text-on-navy-rgb),0.1)',
            border: 'none',
            borderRadius: 0,
            cursor: 'pointer',
          }}
          aria-label="סגור"
        >
          <CloseIcon style={{ width: 18, height: 18, color: 'var(--fs-ink)' }} />
        </button>
      </div>

      {/* Custom Notes */}
      {customNotes && (
        <div
          style={{
            margin: '16px 20px 0',
            padding: '12px 16px',
            background: 'rgba(232,184,45,0.15)',
            border: '2px solid var(--fs-accent)',
            borderRadius: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, direction: 'rtl' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.2em',
                color: 'var(--fs-accent)',
                textTransform: 'uppercase',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              NOTE
            </span>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                color: 'var(--fs-ink)',
                lineHeight: 1.55,
              }}
            >
              {customNotes}
            </p>
          </div>
        </div>
      )}

      {/* Progress */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {currentExerciseSteps.map((_, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: static step progress bars, fixed list, never reordered
              key={index}
              style={{
                flex: 1,
                height: 4,
                background:
                  index <= activeStep ? 'var(--fs-accent)' : 'rgba(var(--text-on-navy-rgb),0.15)',
                borderRadius: 0,
                transition: 'background 300ms',
              }}
            />
          ))}
        </div>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.15em',
            color: 'var(--fs-muted)',
            textTransform: 'uppercase',
            marginTop: 8,
            textAlign: 'center',
          }}
        >
          {activeStep + 1} מתוך {currentExerciseSteps.length}
        </p>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '24px 20px' }}>
        {/* Persistent live region — announces each step on navigation. The visible
            step content remounts per step (keyed by activeStep) so it wouldn't
            announce on its own; this stable node updates its text instead. */}
        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {currentStep
            ? `שלב ${activeStep + 1} מתוך ${currentExerciseSteps.length}${
                currentStep.title ? `: ${currentStep.title}` : ''
              }. ${currentStep.description}`
            : ''}
        </p>
        {visibleDemoImages.length > 0 && (
          <div
            style={{
              marginBottom: 20,
              paddingBottom: 18,
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.15em',
                color: 'var(--fs-muted)',
                textTransform: 'uppercase',
                textAlign: 'center',
                marginBottom: 14,
              }}
            >
              הדגמת תרגיל
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {visibleDemoImages.map(({ src, i }) => (
                <div
                  key={src}
                  style={{
                    flex: 1,
                    border: '1px solid var(--color-border)',
                    background: 'var(--fs-surface)',
                    overflow: 'hidden',
                  }}
                >
                  <img
                    src={src}
                    alt={i === 0 ? `${exerciseName} — תנוחת התחלה` : `${exerciseName} — תנוחת סיום`}
                    loading="lazy"
                    onError={() => setFailedImgs((prev) => new Set(prev).add(i))}
                    style={{
                      display: 'block',
                      width: '100%',
                      aspectRatio: '850 / 567',
                      objectFit: 'cover',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
        {(hasMuscleData || equipmentLabel) && (
          <div
            style={{
              marginBottom: 20,
              paddingBottom: 18,
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            {hasMuscleData && (
              <>
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.15em',
                    color: 'var(--fs-muted)',
                    textTransform: 'uppercase',
                    textAlign: 'center',
                    marginBottom: 14,
                  }}
                >
                  שרירים בעבודה
                </p>
                <MuscleMap
                  primary={primaryMuscle ? [primaryMuscle] : []}
                  secondary={secondaryMuscles ?? []}
                />
              </>
            )}
            {equipmentLabel && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  direction: 'rtl',
                  marginTop: hasMuscleData ? 16 : 0,
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.15em',
                    color: 'var(--fs-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  ציוד
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 13,
                    color: 'var(--fs-ink)',
                    background: 'rgba(232,184,45,0.15)',
                    border: '1px solid var(--fs-accent)',
                    borderRadius: 0,
                    padding: '4px 12px',
                  }}
                >
                  {equipmentLabel}
                </span>
              </div>
            )}
          </div>
        )}
        {currentStep && (
          <m.div
            key={activeStep}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            {/* Step Title */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: 48,
                  color: 'var(--fs-accent)',
                  lineHeight: 0.9,
                  letterSpacing: '-0.02em',
                  direction: 'ltr',
                  textAlign: 'left',
                }}
              >
                {String(activeStep + 1).padStart(2, '0')}
              </div>
              <div>
                {currentStep.title && (
                  <h3
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 22,
                      color: 'var(--fs-ink)',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {currentStep.title}
                  </h3>
                )}
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.15em',
                    color: 'var(--fs-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  שלב {activeStep + 1}
                  {currentStep.title ? '' : ` מתוך ${currentExerciseSteps.length}`}
                </p>
              </div>
            </div>

            {/* Description */}
            <div
              style={{
                padding: 20,
                background: 'rgba(var(--text-on-navy-rgb),0.05)',
                border: '2px solid rgba(var(--text-on-navy-rgb),0.1)',
                borderRadius: 0,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 16,
                  color: 'var(--fs-ink)',
                  lineHeight: 1.6,
                  direction: 'rtl',
                  textAlign: 'right',
                }}
              >
                {currentStep.description}
              </p>

              {currentStep.tip && (
                <div
                  style={{
                    marginTop: 12,
                    padding: '10px 14px',
                    background: 'rgba(232,184,45,0.15)',
                    border: '1px solid var(--fs-accent)',
                    borderRadius: 0,
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.15em',
                      color: 'var(--fs-accent)',
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    טיפ
                  </p>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 14,
                      color: 'var(--fs-ink)',
                      lineHeight: 1.5,
                    }}
                  >
                    {currentStep.tip}
                  </p>
                </div>
              )}
            </div>

            {/* Form tips — static technique reference (not AI-generated) */}
            <button
              type="button"
              onClick={handleShowTips}
              disabled={loading || showContent}
              style={{
                width: '100%',
                padding: '14px 20px',
                background: showContent ? 'rgba(232,184,45,0.1)' : 'transparent',
                color: 'var(--fs-accent)',
                border: '2px solid var(--fs-accent)',
                borderRadius: 0,
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: loading || showContent ? 'default' : 'pointer',
                opacity: loading || showContent ? 0.7 : 1,
              }}
            >
              {loading ? 'טוען טיפים...' : showContent ? 'טיפים לטכניקה' : 'טיפים לטכניקה'}
            </button>

            {showContent && tutorialContent && (
              <m.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                style={{
                  padding: 16,
                  background: 'rgba(var(--text-on-navy-rgb),0.05)',
                  border: '1px solid rgba(var(--text-on-navy-rgb),0.1)',
                  borderRadius: 0,
                  maxHeight: 200,
                  overflowY: 'auto',
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  color: 'var(--fs-ink)',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                }}
              >
                {tutorialContent}
              </m.div>
            )}

            {/* Grounded per-exercise Q&A — answer anchored to the user's real numbers */}
            <div style={{ marginTop: 16 }}>
              <label
                htmlFor="exercise-qa"
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--fs-muted)',
                  marginBottom: 6,
                }}
              >
                שאל על התרגיל
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="exercise-qa"
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAsk();
                  }}
                  placeholder="למשל: איזה משקל לנסות?"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    background: 'rgba(var(--text-on-navy-rgb),0.06)',
                    border: '1px solid rgba(var(--text-on-navy-rgb),0.15)',
                    borderRadius: 0,
                    color: 'var(--fs-ink)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                  }}
                />
                <button
                  type="button"
                  onClick={handleAsk}
                  disabled={asking || !question.trim()}
                  style={{
                    padding: '10px 16px',
                    background: 'var(--fs-accent)',
                    color: 'var(--color-ink-on-accent)',
                    border: 'none',
                    borderRadius: 0,
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: asking || !question.trim() ? 'default' : 'pointer',
                    opacity: asking || !question.trim() ? 0.6 : 1,
                  }}
                >
                  {asking ? '...' : 'שאל'}
                </button>
              </div>
              {answer && (
                <p
                  style={{
                    margin: '10px 0 0',
                    padding: 12,
                    background: 'rgba(var(--text-on-navy-rgb),0.05)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: 'var(--fs-ink)',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {answer}
                </p>
              )}
              {qaError && (
                <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--fs-warn, #d97706)' }}>
                  {qaError}
                </p>
              )}
            </div>
          </m.div>
        )}
      </div>

      {/* Navigation */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '0 20px 20px',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => setActiveStep((prev) => Math.max(prev - 1, 0))}
          disabled={activeStep === 0}
          style={{
            flex: 1,
            padding: '14px 16px',
            // This nav bar sits on --fs-bg (bone), not the navy masthead, so it
            // must use neutral surface tokens — the old text-on-navy values made
            // the label invisible (white text on bone) in light mode.
            background: 'var(--fs-surface)',
            color: 'var(--fs-ink)',
            border: '2px solid var(--fs-steel)',
            borderRadius: 0,
            cursor: activeStep === 0 ? 'not-allowed' : 'pointer',
            opacity: activeStep === 0 ? 0.4 : 1,
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          הקודם
        </button>
        <button
          type="button"
          onClick={() => {
            if (activeStep === currentExerciseSteps.length - 1) onClose();
            else setActiveStep((prev) => prev + 1);
          }}
          style={{
            flex: 1,
            padding: '14px 16px',
            background: 'var(--fs-accent)',
            color: 'var(--color-ink-on-accent)',
            border: '2px solid var(--fs-accent)',
            borderRadius: 0,
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {activeStep === currentExerciseSteps.length - 1 ? 'סיום' : 'הבא'}
        </button>
      </div>

      <div style={{ height: 'env(safe-area-inset-bottom, 8px)', background: 'var(--fs-bg)' }} />
    </m.div>
  );
};

export default React.memo(ExerciseTutorial);
