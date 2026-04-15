import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
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

    const tutorialSteps: TutorialStep[] = useMemo(() => {
        const steps: TutorialStep[] = [
            {
                title: 'תחילת תנועה',
                description: `התחל את תנועת ${exerciseName} מהמצב ההתחלתי הנכון`,
            },
            {
                title: 'טכניקה',
                description: 'בצע את התרגיל בתנועה מ контролируемת וישרה',
                tip: 'שמור על שרירי הליבה מכווצים לאורך כל התנועה',
            },
            {
                title: 'סיום',
                description: 'השלם את הסט בצורה בטוחה ויציבה',
            },
        ];
        return steps;
    }, [exerciseName]);

    const exerciseTips: Record<string, TutorialStep[]> = useMemo(() => ({
        'Bench Press': [
            { title: 'מצב התחלתי', description: 'שכב על הספסל כשהעיניים מתחת למוט' },
            { title: 'אחיזה', description: 'אחז ברוחב כתפיים וחצי, פרקי ידיים ישרים' },
            { title: 'תנועה', description: 'הורד את המוט לאמצע החזה בשליטה' },
            { title: 'לחץ', description: 'דחף למעלה בקו ישר לכיוון הפנים' },
            { title: 'טיפ חשוב', description: 'שמור על הגב צמוד לספסל', tip: 'אל תנעל את המרפקים לחלוטין' },
        ],
        'Squat': [
            { title: 'מצב התחלתי', description: 'עמוד ברוחב כתפיים, מוט על הגב העליון' },
            { title: 'עמדה', description: 'הברכיים בכיוון האצבעות, עקבים ברצפה' },
            { title: 'תנועה', description: 'רד עד שהירכיים מקבילות לרצפה' },
            { title: 'טכניקה', description: 'שמור על הגב ישר, משקל על העקבים' },
            { title: 'עלייה', description: 'דחף דרך העקבים, אל תנעל את הברכיים' },
        ],
        'Deadlift': [
            { title: 'מצב התחלתי', description: 'עמוד קרוב למוט, רגליים ברוחב ירכיים' },
            { title: 'אחיזה', description: 'אחז ברוחב כתפיים, שמור על זווית ישרה בגב' },
            { title: 'תנועה', description: 'הרם עם הרגליים, שמור על הגב ישר' },
            { title: 'סיום', description: 'נעל את הירכיים, כתפיים לאחור' },
            { title: 'טיפ', description: 'אל תעגל את הגב - זו הטעות הנפוצה ביותר', tip: 'השתמש בחגורת אימון למשקולות כבדות' },
        ],
        'Shoulder Press': [
            { title: 'מצב התחלתי', description: 'התחל עם המשקולות בגובה הכתפיים' },
            { title: 'תנועה', description: 'דחף ישר למעלה, מרפקים קלות קדימה' },
            { title: 'שליטה', description: 'הורד בשליטה למצב ההתחלתי' },
            { title: 'טיפ', description: 'אל תקשת את הגב - השאר מרווח קטן במרפקים' },
        ],
        'Pull-ups': [
            { title: 'אחיזה', description: 'אחז רחב מכתפיים, כפות ידיים החוצה' },
            { title: 'תנועה', description: 'משוך את הסנטר מעל המוט' },
            { title: 'שליטה', description: 'שלוט בירידה, אל תיפול' },
            { title: 'טיפ', description: 'הפעל את השרירים מהתחתית - אל תתלה' },
        ],
        'Rows': [
            { title: 'עמדה', description: 'כופף קדימה 45 מעלות, גב ישר' },
            { title: 'תנועה', description: 'משוך אל הבטן התחתונה, מרפקים צמודים' },
            { title: 'לחץ', description: 'לחץ את השכמות יחד בסוף התנועה' },
            { title: 'טיפ', description: 'שמור על הגב ישר לאורך כל התנועה', tip: 'אל תזיז את הגוף - רק הידיים נעות' },
        ],
    }), []);

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
            if (e.key === 'ArrowRight') {
                setActiveStep(prev => Math.min(prev + 1, currentExerciseSteps.length - 1));
            } else if (e.key === 'ArrowLeft') {
                setActiveStep(prev => Math.max(prev - 1, 0));
            } else if (e.key === 'Escape') {
                onClose();
            }
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
            console.error('[ExerciseTutorial] Failed to load tips:', error);
        } finally {
            setLoading(false);
        }
    }, [exerciseName]);

    if (!isOpen) return null;

    return (
        <motion.div
            className="fixed inset-0 z-[11000] bg-black/95 backdrop-blur-xl flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
        >
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10 safe-area-top">
                <div className="flex items-center gap-2">
                    <span className="text-2xl">📖</span>
                    <h2 className="text-lg font-bold text-white">{exerciseName}</h2>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 text-white/60 hover:text-white transition-colors"
                    aria-label="סגור"
                >
                    <CloseIcon className="w-6 h-6" />
                </button>
            </div>

            {/* Custom Notes Banner */}
            {customNotes && (
                <div className="flex-shrink-0 mx-4 mt-4 p-3 rounded-xl bg-[var(--cosmos-accent-primary)]/10 border border-[var(--cosmos-accent-primary)]/30">
                    <div className="flex items-start gap-2">
                        <span className="text-[var(--cosmos-accent-primary)] text-sm">📝</span>
                        <p className="text-sm text-white/80">{customNotes}</p>
                    </div>
                </div>
            )}

            {/* Progress Indicator */}
            <div className="flex-shrink-0 px-4 py-3">
                <div className="flex gap-1.5">
                    {currentExerciseSteps.map((_, index) => (
                        <div
                            key={index}
                            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                                index === activeStep
                                    ? 'bg-[var(--cosmos-accent-primary)]'
                                    : index < activeStep
                                        ? 'bg-[var(--cosmos-accent-primary)]/50'
                                        : 'bg-white/20'
                            }`}
                        />
                    ))}
                </div>
                <p className="text-xs text-white/40 mt-2 text-center">
                    {activeStep + 1} מתוך {currentExerciseSteps.length}
                </p>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-hidden p-4">
                <motion.div
                    key={activeStep}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="h-full flex flex-col"
                >
                    {/* Step Card */}
                    <div className="flex-1 flex flex-col">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-[var(--cosmos-accent-primary)]/20 flex items-center justify-center">
                                <span className="text-2xl">
                                    {activeStep === 0 ? '🎯' : activeStep === currentExerciseSteps.length - 1 ? '✅' : '💪'}
                                </span>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    {currentExerciseSteps[activeStep].title}
                                </h3>
                                <p className="text-sm text-white/60">
                                    שלב {activeStep + 1}
                                </p>
                            </div>
                        </div>

                        <div className="flex-1 p-4 rounded-2xl bg-white/5 border border-white/10">
                            <p className="text-white/90 leading-relaxed">
                                {currentExerciseSteps[activeStep].description}
                            </p>

                            {currentExerciseSteps[activeStep].tip && (
                                <div className="mt-4 p-3 rounded-xl bg-[var(--cosmos-accent-primary)]/10 border border-[var(--cosmos-accent-primary)]/20">
                                    <p className="text-sm text-[var(--cosmos-accent-primary)]">
                                        💡 {currentExerciseSteps[activeStep].tip}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* AI Tips Button */}
                    <div className="mt-4">
                        <button
                            onClick={handleShowTips}
                            disabled={loading || showContent}
                            className="w-full py-3 rounded-xl bg-[var(--cosmos-accent-primary)]/10 border border-[var(--cosmos-accent-primary)]/30 text-[var(--cosmos-accent-primary)] font-medium text-sm disabled:opacity-50"
                        >
                            {loading ? '🤖 טוען טיפים...' : showContent ? '✅ טיפים נטענו' : '🤖 קבל טיפי AI נוספים'}
                        </button>

                        {showContent && tutorialContent && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                className="mt-3 p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white/80 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar"
                            >
                                {tutorialContent}
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Navigation */}
            <div className="flex-shrink-0 flex gap-3 px-4 pb-4 safe-area-bottom">
                <button
                    onClick={() => setActiveStep(prev => Math.max(prev - 1, 0))}
                    disabled={activeStep === 0}
                    className="flex-1 py-3.5 rounded-xl bg-white/10 text-white font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                    <span className="flex items-center justify-center gap-2">
                        <span>→</span>
                        <span>הקודם</span>
                    </span>
                </button>
                <button
                    onClick={() => {
                        if (activeStep === currentExerciseSteps.length - 1) {
                            onClose();
                        } else {
                            setActiveStep(prev => prev + 1);
                        }
                    }}
                    className="flex-1 py-3.5 rounded-xl bg-[var(--cosmos-accent-primary)] text-black font-bold transition-all"
                >
                    <span className="flex items-center justify-center gap-2">
                        <span>{activeStep === currentExerciseSteps.length - 1 ? 'סיום' : 'הבא'}</span>
                        <span>{activeStep === currentExerciseSteps.length - 1 ? '✓' : '→'}</span>
                    </span>
                </button>
            </div>

            <style>{`
                .safe-area-top { padding-top: env(safe-area-inset-top, 0); }
                .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom, 0); }
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
            `}</style>
        </motion.div>
    );
};

export default React.memo(ExerciseTutorial);
