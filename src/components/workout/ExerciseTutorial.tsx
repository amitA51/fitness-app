// ExerciseTutorial - Sport Annual Editorial Design
// Navy overlay · Bone text · Sharp corners
// VISION: Bold · Editorial · Confident · Narrative · Printed

import { motion } from 'framer-motion';
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { logger } from '../../utils/logger';
import { CloseIcon } from '../icons';

interface ExerciseTutorialProps {
  isOpen: boolean;
  exerciseName: string;
  customNotes?: string;
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
  onClose,
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [tutorialContent, setTutorialContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const tutorialSteps: TutorialStep[] = useMemo(
    () => [
      { title: 'תחילת תנועה', description: `התחל את תנועת ${exerciseName} מהמצב ההתחלתי הנכון` },
      { title: 'טכניקה', description: 'בצע את התרגיל בתנועה מבוקרת וישרה', tip: 'שמור על שרירי הליבה מכווצים לאורך כל התנועה' },
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
        { title: 'טיפ חשוב', description: 'שמור על הגב צמוד לספסל', tip: 'אל תנעל את המרפקים לחלוטין' },
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
        { title: 'טיפ', description: 'אל תעגל את הגב - זו הטעות הנפוצה ביותר', tip: 'השתמש בחגורת אימון למשקולות כבדות' },
      ],
    }),
    []
  );

  const currentExerciseSteps = exerciseTips[exerciseName] || tutorialSteps;

  useEffect(() => {
    if (exerciseName) {
      setActiveStep(0);
      setShowContent(false);
      setTutorialContent(null);
    }
  }, [exerciseName]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'ArrowRight') setActiveStep((prev) => Math.min(prev + 1, currentExerciseSteps.length - 1));
      else if (e.key === 'ArrowLeft') setActiveStep((prev) => Math.max(prev - 1, 0));
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

  if (!isOpen) return null;

  const currentStep = currentExerciseSteps[activeStep];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--navy-deep)',
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
          borderBottom: '1px solid rgba(245,241,235,0.1)',
          background: 'var(--navy)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.2em',
              color: 'var(--mustard)',
              textTransform: 'uppercase',
            }}
          >
            § {activeStep + 1}
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 20,
              color: 'var(--bone)',
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
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(245,241,235,0.1)',
            border: 'none',
            borderRadius: 0,
            cursor: 'pointer',
          }}
          aria-label="סגור"
        >
          <CloseIcon style={{ width: 18, height: 18, color: 'var(--bone)' }} />
        </button>
      </div>

      {/* Custom Notes */}
      {customNotes && (
        <div
          style={{
            margin: '16px 20px 0',
            padding: '12px 16px',
            background: 'rgba(232,184,45,0.15)',
            border: '2px solid var(--mustard)',
            borderRadius: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, direction: 'rtl' }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.2em',
                color: 'var(--mustard)',
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
                color: 'var(--bone)',
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
              key={index}
              style={{
                flex: 1,
                height: 4,
                background:
                  index <= activeStep ? 'var(--mustard)' : 'rgba(245,241,235,0.15)',
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
            color: 'rgba(245,241,235,0.4)',
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
        {currentStep && (
          <motion.div
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
                  color: 'var(--mustard)',
                  lineHeight: 0.9,
                  letterSpacing: '-0.02em',
                  direction: 'ltr',
                  textAlign: 'left',
                }}
              >
                {String(activeStep + 1).padStart(2, '0')}
              </div>
              <div>
                <h3
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 22,
                    color: 'var(--bone)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {currentStep.title}
                </h3>
                <p
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    letterSpacing: '0.15em',
                    color: 'rgba(245,241,235,0.4)',
                    textTransform: 'uppercase',
                  }}
                >
                  שלב {activeStep + 1}
                </p>
              </div>
            </div>

            {/* Description */}
            <div
              style={{
                padding: 20,
                background: 'rgba(245,241,235,0.05)',
                border: '2px solid rgba(245,241,235,0.1)',
                borderRadius: 0,
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 16,
                  color: 'var(--bone)',
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
                    border: '1px solid var(--mustard)',
                    borderRadius: 0,
                  }}
                >
                  <p
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.15em',
                      color: 'var(--mustard)',
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
                      color: 'var(--bone)',
                      lineHeight: 1.5,
                    }}
                  >
                    {currentStep.tip}
                  </p>
                </div>
              )}
            </div>

            {/* AI Tips */}
            <button
              type="button"
              onClick={handleShowTips}
              disabled={loading || showContent}
              style={{
                width: '100%',
                padding: '14px 20px',
                background: showContent ? 'rgba(232,184,45,0.1)' : 'transparent',
                color: 'var(--mustard)',
                border: '2px solid var(--mustard)',
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
              {loading ? 'טוען טיפים...' : showContent ? 'טיפים נטענו' : 'טיפים נוספים'}
            </button>

            {showContent && tutorialContent && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                style={{
                  padding: 16,
                  background: 'rgba(245,241,235,0.05)',
                  border: '1px solid rgba(245,241,235,0.1)',
                  borderRadius: 0,
                  maxHeight: 200,
                  overflowY: 'auto',
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  color: 'var(--bone)',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                }}
              >
                {tutorialContent}
              </motion.div>
            )}
          </motion.div>
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
            background: 'rgba(245,241,235,0.08)',
            color: activeStep === 0 ? 'rgba(245,241,235,0.2)' : 'var(--bone)',
            border: '2px solid rgba(245,241,235,0.15)',
            borderRadius: 0,
            cursor: activeStep === 0 ? 'not-allowed' : 'pointer',
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
            background: 'var(--mustard)',
            color: 'var(--navy)',
            border: '2px solid var(--mustard)',
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

      <div style={{ height: 'env(safe-area-inset-bottom, 8px)', background: 'var(--navy-deep)' }} />
    </motion.div>
  );
};

export default React.memo(ExerciseTutorial);
