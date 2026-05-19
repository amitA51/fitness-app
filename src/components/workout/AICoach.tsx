import DOMPurify from 'dompurify';
import { motion } from 'framer-motion';
import React, { useState, useCallback, useMemo } from 'react';
import {
  type ExerciseChatMessage,
  askExerciseQuestion,
  getExerciseTutorial,
  getWorkoutAdvice,
  suggestExercises,
} from '../../services/ai';
import { humanizeAIError } from '../../services/ai/errorMessages';
import { getRecoveryLogsByDateRange } from '../../services/bodyStatsService';
import { getWorkoutSessions } from '../../services/dataService';
import { DEFAULT_MACRO_GOALS, getTodayMacros } from '../../services/nutritionService';
import type { Exercise } from '../../types';
import { logger } from '../../utils/logger';
import { CloseIcon } from '../icons';

interface AICoachProps {
  onClose: () => void;
  currentExercise?: Exercise;
}

type CoachTab = 'chat' | 'suggestions' | 'analysis';

interface ExerciseSuggestion {
  name: string;
  muscleGroup: string;
  defaultRestTime: number;
  defaultSets: number;
  tempo: string;
  notes: string;
}

/**
 * AICoach - Integrated AI workout assistant
 * Features: Chat with coach, exercise suggestions, workout analysis
 */
const AICoach: React.FC<AICoachProps> = ({ onClose, currentExercise }) => {
  const [activeTab, setActiveTab] = useState<CoachTab>('chat');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ExerciseChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [tutorialContent, setTutorialContent] = useState<string | null>(null);

  // Suggestions state
  const [muscleGroup, setMuscleGroup] = useState('Chest');
  const [suggestions, setSuggestions] = useState<ExerciseSuggestion[]>([]);

  // Analysis state
  const [analysis, setAnalysis] = useState<string | null>(null);

  const muscleGroups = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core'];

  // Static offline tips for common exercises
  const offlineTips: Record<string, string> = useMemo(
    () => ({
      'Bench Press':
        '**Bench Press**\n\n• שכב על הספסל כשהעיניים מתחת למוט\n• אחיזה ברוחב כתפיים וחצי\n• הורד את המוט לאמצע החזה\n• דחף למעלה בקו ישר\n• שמור על הגב צמוד לספסל',
      Squat:
        '**Squat**\n\n• עמוד ברוחב כתפיים\n• הברכיים בכיוון האצבעות\n• רד עד שהירכיים מקבילות לרצפה\n• שמור על הגב ישר\n• דחף דרך העקבים',
      Deadlift:
        '**Deadlift**\n\n• עמוד קרוב למוט\n• אחיזה ברוחב כתפיים\n• שמור על הגב ישר לאורך התנועה\n• הרם עם הרגליים, לא עם הגב\n• נעל את הירכיים בסוף',
      'Shoulder Press':
        '**Shoulder Press**\n\n• התחל עם המשקולות בגובה הכתפיים\n• דחף ישר למעלה\n• אל תקשת את הגב\n• הורד בשליטה',
      'Pull-ups':
        '**Pull-ups**\n\n• אחיזה רחבה מכתפיים\n• משוך את הסנטר מעל המוט\n• שלוט בירידה\n• הפעל את השרירים מהתחתית',
      Rows: '**Rows**\n\n• כופף קדימה 45 מעלות\n• משוך אל הבטן התחתונה\n• לחץ את השכמות יחד\n• שמור על הגב ישר',
      default:
        '**טיפים כלליים לאימון**\n\n• חמם היטב לפני תרגילים כבדים\n• שמור על טכניקה נכונה\n• נשום - נשוף במאמץ\n• שלוט בתנועה בשני הכיוונים\n• הגדל משקל בהדרגה',
    }),
    []
  );

  // Load tutorial when exercise changes - with caching
  const loadTutorial = useCallback(async () => {
    if (!currentExercise?.name) return;

    setLoading(true);
    setError(null);

    // Check localStorage cache first
    const cacheKey = `ai_tutorial_${currentExercise.name.toLowerCase().replace(/\s+/g, '_')}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setTutorialContent(cached);
        setLoading(false);
        return;
      }
    } catch {
      /* localStorage not available */
    }

    try {
      const tutorial = await getExerciseTutorial(currentExercise.name);
      setTutorialContent(tutorial);
      // Cache successful response
      try {
        localStorage.setItem(cacheKey, tutorial ?? '');
      } catch {
        /* localStorage full or not available */
      }
    } catch (e: unknown) {
      logger.ai.error('Tutorial load error', e);

      const exerciseName = currentExercise.name;
      const offlineTip =
        Object.entries(offlineTips).find(([key]) =>
          exerciseName.toLowerCase().includes(key.toLowerCase())
        )?.[1] || offlineTips['default'];

      setTutorialContent(offlineTip + '\n\n---\n_טיפ אופליין - התחבר לאינטרנט לתוכן מלא_');
      setError(humanizeAIError(e));
    } finally {
      setLoading(false);
    }
  }, [currentExercise?.name, offlineTips]);

  // Send chat message
  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !currentExercise?.name) return;

    const userMessage: ExerciseChatMessage = { role: 'user', content: inputMessage };
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);
    setError(null);

    try {
      const response = await askExerciseQuestion(currentExercise.name, inputMessage, messages);
      const assistantMessage: ExerciseChatMessage = { role: 'assistant', content: response };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (e) {
      logger.ai.error('Chat error', e);
      setError(humanizeAIError(e));
    } finally {
      setLoading(false);
    }
  }, [inputMessage, currentExercise?.name, messages]);

  // Get exercise suggestions
  const handleGetSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await suggestExercises(muscleGroup);
      // suggestExercises returns string[], convert to ExerciseSuggestion[]
      const mapped: ExerciseSuggestion[] = results.map((name, _i) => ({
        name,
        muscleGroup,
        defaultRestTime: 90,
        defaultSets: 3,
        tempo: '2-1-2',
        notes: `תרגיל ${muscleGroup} מומלץ`,
      }));
      setSuggestions(mapped);
    } catch (e) {
      logger.ai.error('Suggestions error', e);
      setError(humanizeAIError(e));
    } finally {
      setLoading(false);
    }
  }, [muscleGroup]);

  // Analyze workout history
  const handleAnalyzeWorkouts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sessions = await getWorkoutSessions(30);

      if (sessions.length < 3) {
        setAnalysis('נדרשים לפחות 3 אימונים לניתוח מעמיק.');
        return;
      }

      // Gather recovery logs for last 14 days and today's macros
      const today = new Date();
      const fourteenDaysAgo = new Date(today);
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const startIso = fourteenDaysAgo.toISOString().split('T')[0] ?? '';
      const endIso = today.toISOString().split('T')[0] ?? '';

      try {
        const [recoveryLogs, todayMacros] = await Promise.all([
          getRecoveryLogsByDateRange(startIso, endIso),
          getTodayMacros(),
        ]);

        const advice = await getWorkoutAdvice(sessions, recoveryLogs, {
          dailyAverage: todayMacros,
          goal: DEFAULT_MACRO_GOALS,
        });
        setAnalysis(advice);
      } catch (aiErr) {
        logger.ai.warn('AI analysis unavailable, falling back to local analysis', aiErr);

        // Fallback: local analysis without emoji markers
        const totalSessions = sessions.length;
        const totalDuration = sessions.reduce(
          (sum, s) => sum + ((s as { duration?: number }).duration ?? 0),
          0
        );
        const avgDuration = Math.round(totalDuration / totalSessions / 60);

        const exerciseCount: Record<string, number> = {};
        const muscleCount: Record<string, number> = {};
        let totalVolume = 0;
        let totalSets = 0;

        sessions.forEach((session) => {
          session.exercises?.forEach((ex) => {
            exerciseCount[ex.exerciseName] = (exerciseCount[ex.exerciseName] || 0) + 1;
            if (ex.muscleGroup) {
              muscleCount[ex.muscleGroup] = (muscleCount[ex.muscleGroup] || 0) + 1;
            }
            ex.sets?.forEach((set) => {
              if (set.weight && set.reps) {
                totalVolume += set.weight * set.reps;
                totalSets++;
              }
            });
          });
        });

        const topExercises = Object.entries(exerciseCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);

        const topMuscles = Object.entries(muscleCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 3);

        const muscleAdvice =
          topMuscles.length < 3 ? 'שקול לגוון יותר קבוצות שרירים' : 'מגוון קבוצות שרירים טוב';
        const durationAdvice =
          avgDuration < 30
            ? 'אימונים קצרים - שקול להאריך'
            : avgDuration > 90
              ? 'אימונים ארוכים - שקול לקצר'
              : 'משך אימון אידיאלי';

        const analysisText = `
## ניתוח 30 הימים האחרונים

### סטטיסטיקות כלליות
- **${totalSessions}** אימונים סה״כ
- **${avgDuration}** דקות ממוצע לאימון
- **${totalSets}** סטים הושלמו
- **${Math.round(totalVolume / 1000)}** טון נפח כולל

### תרגילים מובילים
${topExercises.map(([name, count], i) => `${i + 1}. **${name}** - ${count} פעמים`).join('\n')}

### קבוצות שרירים
${topMuscles.map(([name, count]) => `- ${name}: ${count} פעמים`).join('\n')}

### המלצות
- ${muscleAdvice}
- ${durationAdvice}
      `.trim();

        setAnalysis(analysisText);
      }
    } catch (e) {
      logger.ai.error('Analysis error', e);
      setError(humanizeAIError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const renderContent = useMemo(() => {
    switch (activeTab) {
      case 'chat':
        return (
          <div className="flex flex-col h-full">
            {/* Tutorial Panel */}
            {currentExercise && (
              <div className="mb-4">
                <button
                  onClick={loadTutorial}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-[var(--fs-accent)]/10 border border-[var(--fs-accent)]/30 text-[var(--fs-accent)] font-medium text-sm"
                >
                  {loading ? 'טוען...' : `הדרכה · ${currentExercise.name}`}
                </button>
                {tutorialContent && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="mt-3 p-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white/80 whitespace-pre-wrap overflow-y-auto max-h-40"
                  >
                    {tutorialContent}
                  </motion.div>
                )}
              </div>
            )}

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 mb-4 custom-scrollbar">
              {messages.length === 0 && (
                <div className="text-center text-white/40 py-8">
                  <p className="text-sm">שאל אותי כל שאלה על התרגיל!</p>
                  <p className="text-xs mt-1 text-white/30">למשל: "איך לשפר את הטכניקה?"</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-xl max-w-[85%] ${
                    msg.role === 'user'
                      ? 'bg-[var(--fs-accent)]/20 ml-auto text-white'
                      : 'bg-white/10 mr-auto text-white/90'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </motion.div>
              ))}
              {loading && (
                <div className="text-white/50 text-sm flex items-center gap-2">
                  <span className="animate-pulse">●</span> חושב...
                </div>
              )}
            </div>

            {/* Input */}
            <div
              className="flex gap-2"
              style={{
                paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
                paddingTop: 12,
              }}
            >
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="שאל שאלה..."
                disabled={!currentExercise}
                className="flex-1 h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-[var(--fs-accent)] disabled:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || loading || !currentExercise}
                className="px-5 h-12 rounded-xl bg-[var(--fs-accent)] text-black font-bold disabled:opacity-40"
              >
                שלח
              </button>
            </div>
          </div>
        );

      case 'suggestions':
        return (
          <div className="space-y-4">
            {/* Muscle Group Selector */}
            <div>
              <label className="text-white/60 text-xs mb-2 block">בחר קבוצת שרירים</label>
              <div className="flex gap-2 flex-wrap">
                {muscleGroups.map((group) => (
                  <button
                    key={group}
                    onClick={() => setMuscleGroup(group)}
                    aria-pressed={muscleGroup === group}
                    className={`px-4 py-3 min-h-[44px] rounded-full text-xs font-medium transition-all ${
                      muscleGroup === group
                        ? 'bg-[var(--fs-accent)] text-black'
                        : 'bg-white/10 text-white/65'
                    }`}
                  >
                    {group}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleGetSuggestions}
              disabled={loading}
              className="w-full h-12 rounded-xl bg-[var(--fs-accent)] text-black font-bold disabled:opacity-50"
            >
              {loading ? 'טוען המלצות...' : 'קבל המלצות AI'}
            </button>

            {/* Results */}
            <div className="space-y-3 max-h-[40vh] overflow-y-auto custom-scrollbar">
              {suggestions.map((ex, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <h4 className="font-bold text-white mb-1">{ex.name}</h4>
                  <div className="flex gap-3 text-xs text-white/50 mb-2">
                    <span>{ex.defaultRestTime}s מנוחה</span>
                    <span>{ex.defaultSets} סטים</span>
                    <span>tempo {ex.tempo}</span>
                  </div>
                  <p className="text-sm text-white/70">{ex.notes}</p>
                </motion.div>
              ))}
            </div>
          </div>
        );

      case 'analysis':
        return (
          <div className="space-y-4">
            <button
              onClick={handleAnalyzeWorkouts}
              disabled={loading}
              className="w-full h-12 rounded-xl bg-[var(--fs-accent)] text-black font-bold disabled:opacity-50"
            >
              {loading ? 'מנתח אימונים...' : 'נתח את האימונים שלי'}
            </button>

            {analysis && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 rounded-xl bg-white/5 border border-white/10 prose prose-invert prose-sm max-w-none overflow-y-auto max-h-[50vh] custom-scrollbar"
              >
                <div
                  className="text-sm text-white/90 whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{
                    // SECURITY: Sanitize HTML to prevent XSS attacks
                    __html: DOMPurify.sanitize(
                      analysis
                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                        .replace(
                          /^## (.+)$/gm,
                          '<h3 class="text-lg font-bold text-white mt-4 mb-2">$1</h3>'
                        )
                        .replace(
                          /^### (.+)$/gm,
                          '<h4 class="text-base font-semibold text-white/90 mt-3 mb-1">$1</h4>'
                        )
                        .replace(
                          /^- (.+)$/gm,
                          '<div class="flex items-start gap-2"><span>•</span><span>$1</span></div>'
                        )
                    ),
                  }}
                />
              </motion.div>
            )}
          </div>
        );
    }
  }, [
    activeTab,
    currentExercise,
    loading,
    messages,
    inputMessage,
    tutorialContent,
    muscleGroup,
    suggestions,
    analysis,
    loadTutorial,
    handleSendMessage,
    handleGetSuggestions,
    handleAnalyzeWorkouts,
  ]);

  return (
    <motion.div
      className="premium-dark-surface scrim-noise ambient-mesh fixed inset-0 z-[11000] flex flex-col"
      initial={{ opacity: 0, y: '100%' }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: '100%' }}
      transition={{ type: 'spring', damping: 30 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-coach-title"
    >
      {/* Header */}
      <div
        className="glass-surface-dark flex-shrink-0 flex items-center justify-between px-4 py-3"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top, 12px))' }}
      >
        <h2
          id="ai-coach-title"
          className="text-lg font-bold text-white inline-flex items-center gap-2"
        >
          <span className="breathing-dot" aria-hidden="true" />
          מאמן AI
        </h2>
        <button
          onClick={onClose}
          className="w-11 h-11 flex items-center justify-center text-white/60 hover:text-white"
          aria-label="סגור"
        >
          <CloseIcon className="w-6 h-6" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-2 px-4 py-3 border-b border-white/10">
        {[
          { id: 'chat', label: 'צ׳אט', disabled: !currentExercise },
          { id: 'suggestions', label: 'המלצות' },
          { id: 'analysis', label: 'ניתוח' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && setActiveTab(tab.id as CoachTab)}
            disabled={tab.disabled}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            className={`flex-1 py-3 min-h-[44px] rounded-xl text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? 'bg-[var(--fs-accent)] text-black'
                : tab.disabled
                  ? 'bg-white/5 text-white/30 cursor-not-allowed'
                  : 'bg-white/10 text-white/70'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden p-4">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}
        {renderContent}
      </div>
    </motion.div>
  );
};

export default React.memo(AICoach);
