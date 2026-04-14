// ExerciseTutorial - AI-powered exercise tutorial overlay
// Uses Portal rendering via ModalOverlay for proper z-index stacking and focus management
import React from 'react';
import { motion } from 'framer-motion';
import {
  getExerciseTutorial,
  askExerciseQuestion,
  ExerciseChatMessage,
} from '../../services/ai';
import { ModalOverlay } from '../ui/ModalOverlay';

interface ExerciseTutorialProps {
  exerciseName: string;
  customNotes?: string;
  isOpen: boolean;
  onClose: () => void;
}

// Simple dictionary as a fallback when AI is unavailable.
const TUTORIALS: Record<
  string,
  { description: string; keyPoints: string[]; commonMistakes: string[] }
> = {
  'bench press': {
    description: 'תרגיל מרוכב שמתמקד בחזה, כתפיים וטריצפס.',
    keyPoints: [
      'שמור על כפות רגליים שטוחות על הרצפה.',
      'קשת קלה בגב, הישבן נשאר על הספסל.',
      'הורד את המוט לאמצע החזה.',
      'דחוף את המוט חזרה למעלה בקשת קלה לכיוון הפנים.',
    ],
    commonMistakes: [
      'קפיצה של המוט מהחזה.',
      'מרפקים פתוחים מדי (שמור על ~45 מעלות).',
      'הרמת הישבן מהספסל.',
    ],
  },
  squat: {
    description: 'מלך תרגילי הרגליים - מתמקד בקוואדריספס, המסטרינג והישבן.',
    keyPoints: [
      'שמור על חזה מורם ומרכז מתוח.',
      'שבור בירכיים ובברכיים בו-זמנית.',
      'שמור על ברכיים בקו עם קצות הרגליים.',
      'ירידה עד שהירכיים מקבילים לרצפה לפחות.',
    ],
    commonMistakes: [
      'ברכיים נכנסות פנימה.',
      'עיגול הגב התחתון.',
      'ירידה לא מספיק עמוקה.',
    ],
  },
  deadlift: {
    description: 'תרגיל משיכה לכל הגוף - מתמקד בשרשרת האחורית.',
    keyPoints: [
      'עמוד עם רגליים ברוחב האגן.',
      'אחיזת מוט מחוץ לרגליים.',
      'שמור על גב ישר וחזה מורם.',
      'דחוף דרך העקבים והרחב את הירכיים.',
    ],
    commonMistakes: [
      'עיגול הגב.',
      'משיכה חדה של המוט.',
      'כיפוף יתר של הגב בסוף.',
    ],
  },
};

const ExerciseTutorial: React.FC<ExerciseTutorialProps> = ({
  exerciseName,
  customNotes,
  isOpen,
  onClose,
}) => {
  const normalizedName = exerciseName.toLowerCase();
  const tutorialKey = Object.keys(TUTORIALS).find(key => normalizedName.includes(key));
  const fallbackTutorial = tutorialKey ? TUTORIALS[tutorialKey] : null;

  const [messages, setMessages] = React.useState<ExerciseChatMessage[]>([]);
  const [loadingIntro, setLoadingIntro] = React.useState(true);
  const [aiError, setAiError] = React.useState<string | null>(null);
  const [question, setQuestion] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    
    let cancelled = false;
    const cacheKey = `tutorial_cache_${exerciseName}`;

    const run = async () => {
      setLoadingIntro(true);
      setAiError(null);
      setMessages([]);

      // Check sessionStorage cache first
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          if (!cancelled) {
            setMessages([{ role: 'assistant', content: cached }]);
            setLoadingIntro(false);
          }
          return;
        }
      } catch { /* sessionStorage unavailable */ }

      try {
        const intro = await getExerciseTutorial(exerciseName);
        if (cancelled) return;
        setMessages([{ role: 'assistant', content: intro || '' }]);
        // Cache successful response
        try { sessionStorage.setItem(cacheKey, intro || ''); } catch { /* storage full */ }
      } catch (error) {
        console.error('Failed to load AI tutorial for exercise', error);
        if (cancelled) return;
        setAiError('ה-AI לא זמין כרגע, מציג מדריך בסיסי.');
        if (fallbackTutorial) {
          const text = [
            fallbackTutorial.description,
            '',
            'נקודות מפתח:',
            ...fallbackTutorial.keyPoints.map(p => `• ${p}`),
            '',
            'טעויות נפוצות:',
            ...fallbackTutorial.commonMistakes.map(p => `• ${p}`),
          ].join('\n');
          setMessages([{ role: 'assistant', content: text }]);
        }
      } finally {
        if (!cancelled) setLoadingIntro(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [exerciseName, customNotes, fallbackTutorial, isOpen]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;
    const newUserMessage: ExerciseChatMessage = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, newUserMessage]);
    setQuestion('');
    setIsSending(true);
    try {
      const answer = await askExerciseQuestion(
        exerciseName,
        trimmed,
        messages.concat(newUserMessage)
      );
      setMessages(prev => [...prev, { role: 'assistant', content: answer }]);
    } catch (error) {
      console.error('Failed to ask exercise question', error);
      setAiError('לא הצלחתי לקבל תשובה מה-AI כרגע.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      variant="modal"
      zLevel="extreme"
      backdropOpacity={80}
      blur="sm"
      trapFocus
      lockScroll
      closeOnBackdropClick
      closeOnEscape
      ariaLabel={`מדריך ${exerciseName}`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-[520px] max-h-[82vh] flex flex-col bg-[var(--cosmos-bg-primary)] rounded-2xl border border-[var(--cosmos-glass-border)] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-[var(--cosmos-glass-border)]">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg font-extrabold text-[var(--cosmos-text-primary)] m-0">
              {exerciseName}
            </h2>
            <p className="text-[11px] text-[var(--cosmos-text-muted)]">
              בינה מלאכותית מסבירה את הטכניקה ועונה על שאלות על התרגיל.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--cosmos-text-muted)] hover:text-[var(--cosmos-text-primary)] transition-colors text-xl p-1"
            aria-label="סגור"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar space-y-4">
          {loadingIntro && (
            <div className="text-center py-6 text-[var(--cosmos-text-muted)] text-sm">
              טוען הסבר מה-AI על התרגיל...
            </div>
          )}

          {aiError && (
            <div className="text-xs text-[var(--cosmos-accent-danger)] bg-[var(--cosmos-accent-danger)]/10 border border-[var(--cosmos-accent-danger)]/40 rounded-xl px-3 py-2">
              {aiError}
            </div>
          )}

          {/* Chat history */}
          <div className="space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`max-w-full rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-line border ${msg.role === 'assistant'
                  ? 'bg-[var(--cosmos-glass-bg)]/80 border-[var(--cosmos-glass-border)] text-[var(--cosmos-text-primary)]'
                  : 'bg-[var(--cosmos-accent-primary)] text-black border-[var(--cosmos-accent-primary)]/60 ml-auto'
                  }`}
              >
                {msg.content}
              </div>
            ))}

            {!loadingIntro && messages.length === 0 && fallbackTutorial && (
              <div className="text-sm text-[var(--cosmos-text-primary)] whitespace-pre-line bg-[var(--cosmos-glass-bg)]/60 border border-[var(--cosmos-glass-border)] rounded-2xl px-3 py-2">
                {fallbackTutorial.description}
              </div>
            )}

            {customNotes && (
              <div className="mt-2 p-3 bg-white/5 rounded-xl border border-white/5">
                <h3 className="text-[var(--cosmos-accent-secondary)] text-[10px] uppercase tracking-wider font-bold mb-1">
                  ההערות שלך
                </h3>
                <p className="text-[var(--cosmos-text-primary)] text-xs leading-relaxed">
                  {customNotes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Question input */}
        <form
          onSubmit={handleAsk}
          className="border-t border-[var(--cosmos-glass-border)] px-4 py-3 bg-[var(--cosmos-bg-primary)]/95"
        >
          <div className="text-[10px] text-[var(--cosmos-text-muted)] mb-1">
            שאל את ה-AI על טכניקה, נפח, וריאציות, תחושות שריר וכו'.
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="לדוגמה: איפה אני צריך להרגיש את התרגיל?"
              className="flex-1 px-3 py-2 rounded-xl bg-black/40 border border-[var(--cosmos-glass-border)] text-sm text-[var(--cosmos-text-primary)] placeholder:text-[var(--cosmos-text-muted)] outline-none focus:border-[var(--cosmos-accent-primary)]"
            />
            <button
              type="submit"
              disabled={!question.trim() || isSending}
              className="px-4 py-2 rounded-xl bg-[var(--cosmos-accent-primary)] text-black text-xs font-bold tracking-[0.16em] uppercase shadow-[0_0_16px_rgba(129,140,248,0.5)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? 'חושב...' : 'שאל'}
            </button>
          </div>
        </form>
      </motion.div>
    </ModalOverlay>
  );
};

export default React.memo(ExerciseTutorial);
