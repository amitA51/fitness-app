// ExerciseTutorial — the in-workout AI coach panel.
//
// Three jobs used to be dumped into one endless scroll (technique carousel,
// grounded Q&A, set note), each in its own visual language: a navy masthead with
// dark ink on it (unreadable), leftover gold #e8b82d tints from a retired
// palette, white-on-bone surfaces that rendered as nothing, and one tracked-out
// mono label on every single string. This is the same content on one system:
// the app's own chrome (translucent --fs-bg header, --fs-surface cards, --fs-steel
// edges, mint accent through color-mix), tokens only, and the three jobs split
// into named tabs so each one is a short, readable panel.

import { m } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  X as CloseIcon,
  MessageCircleQuestion,
  NotebookPen,
  Sparkles,
} from 'lucide-react';
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { translateEquipment } from '../../constants/equipmentNames';
import {
  translateForce,
  translateLevel,
  translateMechanic,
} from '../../constants/exerciseClassification';
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
  /** Movement pattern — `compound` / `isolation`. Shown beside the equipment. */
  mechanic?: string;
  /** Resistance direction — `push` / `pull` / `static`. */
  force?: string;
  /** Required skill — `beginner` / `intermediate` / `expert`. */
  level?: string;
  /** The exercise's own execution cue — segmented into ordered steps. */
  instructions?: string;
  /** Current set's personal note. Edited here (the note strip used to sit at the
   *  top of the active screen; it now lives with the AI coach). */
  note?: string;
  /** Persist the set note. Omitted when note editing isn't available. */
  onSaveNote?: (note: string) => void;
  onClose: () => void;
}

/** One-tap note fragments for the set note. */
const QUICK_NOTES = [
  'כאב קל',
  'הרגשה מצוינת',
  'משקל קל מדי',
  'משקל כבד מדי',
  'טכניקה לקויה',
  'שליטה מלאה',
];

type TabId = 'guide' | 'ask' | 'note';

interface TutorialStep {
  title: string;
  description: string;
  tip?: string;
}

// ── Shared surfaces ─────────────────────────────────────────────────────────
// One card idiom for the whole panel, matching the active-workout surfaces.

const card: React.CSSProperties = {
  background: 'var(--fs-surface)',
  border: '1px solid var(--fs-steel)',
  borderRadius: 'var(--radius-lg)',
  padding: 16,
};

const accentCard: React.CSSProperties = {
  background: 'color-mix(in srgb, var(--fs-accent) 10%, var(--fs-surface))',
  border: '1px solid color-mix(in srgb, var(--fs-accent) 28%, transparent)',
  borderRadius: 'var(--radius-lg)',
  padding: 14,
};

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 13px',
  background: 'var(--fs-surface)',
  border: '1px solid var(--fs-steel)',
  borderRadius: 'var(--radius-md)',
  color: 'var(--fs-ink)',
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  lineHeight: 1.5,
};

/** Section heading inside a panel. Plain display type — no tracked-out caps. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 600,
        fontSize: 14,
        color: 'var(--fs-muted)',
        margin: '0 0 10px',
      }}
    >
      {children}
    </h3>
  );
}

const ExerciseTutorial: React.FC<ExerciseTutorialProps> = ({
  isOpen,
  exerciseName,
  customNotes,
  primaryMuscle,
  secondaryMuscles,
  equipment,
  mechanic,
  force,
  level,
  instructions,
  note,
  onSaveNote,
  onClose,
}) => {
  const [tab, setTab] = useState<TabId>('guide');
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
  const [noteDraft, setNoteDraft] = useState(note ?? '');
  const [noteSaved, setNoteSaved] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<TabId, HTMLButtonElement | null>>({
    guide: null,
    ask: null,
    note: null,
  });

  useFocusTrap(containerRef, { isOpen, onClose, closeOnEscape: true, lockScroll: true });

  // The bilingual catalog name is "Hebrew | English"; the Hebrew side carries the
  // title and the English side is the catalog key.
  const hebrewName = useMemo(() => {
    const idx = exerciseName.lastIndexOf('|');
    return (idx >= 0 ? exerciseName.slice(0, idx) : exerciseName).trim();
  }, [exerciseName]);

  // Generic fallback beats. The movement is NOT interpolated here: the masthead
  // already names it two lines above, and splicing a bilingual label with a "45°"
  // into an RTL sentence reordered the degree sign away from its number.
  const tutorialSteps: TutorialStep[] = useMemo(
    () => [
      { title: 'תחילת תנועה', description: 'התחילו את התנועה מהמצב ההתחלתי הנכון' },
      {
        title: 'טכניקה',
        description: 'בצעו את התרגיל בתנועה מבוקרת וישרה',
        tip: 'שמרו על שרירי הליבה מכווצים לאורך כל התנועה',
      },
      { title: 'סיום', description: 'סיימו את הסט בצורה בטוחה ויציבה' },
    ],
    []
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
  // What the movement IS, in the order a lifter asks: pattern, direction, skill.
  // Rendered as plain labelled facts rather than badges so the equipment badge
  // stays the single accent in this card.
  const classificationFacts = [
    { label: 'סוג', value: translateMechanic(mechanic) },
    { label: 'כיוון', value: translateForce(force) },
    { label: 'רמה', value: translateLevel(level) },
  ].filter((fact) => Boolean(fact.value));
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

  // Seed the editor from the saved note each time the panel OPENS (or lands on
  // another exercise). Read through a ref, not a dep: saving updates `note`, and
  // re-running on that change would wipe the "נשמר" confirmation the user just
  // earned — and could clobber their in-progress edits.
  const noteRef = useRef(note);
  noteRef.current = note;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `note` is read via ref on purpose (see above)
  useEffect(() => {
    if (!isOpen) return;
    setNoteDraft(noteRef.current ?? '');
    setNoteSaved(false);
    setTab('guide');
  }, [isOpen, exerciseName]);

  const handleSaveNote = useCallback(() => {
    if (!onSaveNote) return;
    onSaveNote(noteDraft.trim());
    setNoteSaved(true);
  }, [noteDraft, onSaveNote]);

  const handleQuickNote = useCallback((chip: string) => {
    setNoteSaved(false);
    setNoteDraft((prev) => (prev.trim() ? `${prev}, ${chip}` : chip));
  }, []);

  const lastStep = currentExerciseSteps.length - 1;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Step arrows apply to the guide only, and never while the user is typing
      // into the question box or the note.
      if (tab !== 'guide') return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;
      // RTL carousel: "הבא" sits on the LEFT and the spine advances right-to-left,
      // so ArrowLeft advances and ArrowRight goes back (WAI-ARIA RTL convention).
      if (e.key === 'ArrowLeft') setActiveStep((prev) => Math.min(prev + 1, lastStep));
      else if (e.key === 'ArrowRight') setActiveStep((prev) => Math.max(prev - 1, 0));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, lastStep, onClose, tab]);

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

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'guide', label: 'ביצוע', icon: <Sparkles size={15} strokeWidth={2.3} /> },
    { id: 'ask', label: 'שאלה', icon: <MessageCircleQuestion size={15} strokeWidth={2.3} /> },
    ...(onSaveNote
      ? [{ id: 'note' as TabId, label: 'פתק', icon: <NotebookPen size={15} strokeWidth={2.3} /> }]
      : []),
  ];

  // RTL tablist: ArrowLeft moves to the NEXT tab (the one drawn to the left).
  const handleTabKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let next = i;
    if (e.key === 'ArrowLeft') next = Math.min(i + 1, TABS.length - 1);
    else if (e.key === 'ArrowRight') next = Math.max(i - 1, 0);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    else return;
    e.preventDefault();
    const id = TABS[next]?.id;
    if (!id) return;
    setTab(id);
    tabRefs.current[id]?.focus();
  };

  if (!isOpen) return null;

  const currentStep = currentExerciseSteps[activeStep];

  return (
    <div
      ref={containerRef}
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
      }}
    >
      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 16px',
          // This full-screen surface has no content visible beneath its masthead;
          // solid chrome preserves contrast and removes unnecessary backdrop work.
          background: 'var(--fs-bg)',
          borderBottom: '0.5px solid var(--color-separator)',
          flexShrink: 0,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2
            id="tutorial-title"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 19,
              color: 'var(--fs-heading)',
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
            }}
          >
            מאמן AI
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              color: 'var(--fs-muted)',
              lineHeight: 1.3,
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {hebrewName || exerciseName}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-1"
          style={{
            width: 42,
            height: 42,
            minWidth: 42,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--fs-surface-2)',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            color: 'var(--fs-ink)',
            cursor: 'pointer',
            flexShrink: 0,
          }}
          aria-label="סגור את המאמן"
        >
          <CloseIcon size={18} strokeWidth={2.25} />
        </button>
      </header>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="מדורי המאמן"
        onKeyDown={handleTabKey}
        style={{
          display: 'flex',
          gap: 4,
          margin: '12px 16px 0',
          padding: 4,
          background: 'var(--fs-surface-2)',
          borderRadius: 'var(--radius-full)',
          flexShrink: 0,
        }}
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`coach-tab-${t.id}`}
              aria-selected={active}
              aria-controls={`coach-panel-${t.id}`}
              tabIndex={active ? 0 : -1}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              onClick={() => setTab(t.id)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                minHeight: 40,
                borderRadius: 'var(--radius-full)',
                border: 'none',
                background: active ? 'var(--fs-surface)' : 'transparent',
                color: active ? 'var(--fs-heading)' : 'var(--fs-muted)',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'background 160ms ease, color 160ms ease',
              }}
            >
              <span style={{ color: active ? 'var(--fs-accent-2)' : 'var(--fs-muted)' }}>
                {t.icon}
              </span>
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Panels ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 24px', minHeight: 0 }}>
        {/* ---------------------------------------------------------- GUIDE */}
        {tab === 'guide' && (
          <div
            role="tabpanel"
            id="coach-panel-guide"
            aria-labelledby="coach-tab-guide"
            style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            {/* The program's own coaching cue for this movement. */}
            {customNotes && (
              <div style={accentCard}>
                <SectionTitle>הנחיית התוכנית</SectionTitle>
                <p
                  /* Program cues arrive in either language; let the first strong
                     character pick the direction so an English line isn't
                     reordered by the RTL panel around it. */
                  dir="auto"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 15,
                    color: 'var(--fs-ink)',
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {customNotes}
                </p>
              </div>
            )}

            {visibleDemoImages.length > 0 && (
              <div>
                <SectionTitle>הדגמת התרגיל</SectionTitle>
                <div style={{ display: 'flex', gap: 10 }}>
                  {visibleDemoImages.map(({ src, i }) => (
                    <div
                      key={src}
                      style={{
                        flex: 1,
                        border: '1px solid var(--fs-steel)',
                        background: 'var(--fs-surface)',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                      }}
                    >
                      <img
                        src={src}
                        alt={i === 0 ? `${hebrewName} — תנוחת התחלה` : `${hebrewName} — תנוחת סיום`}
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

            {(hasMuscleData || equipmentLabel || classificationFacts.length > 0) && (
              <div style={card}>
                {hasMuscleData && (
                  <>
                    <SectionTitle>שרירים בעבודה</SectionTitle>
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
                      gap: 10,
                      marginTop: hasMuscleData ? 16 : 0,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-body)',
                        fontSize: 14,
                        color: 'var(--fs-muted)',
                      }}
                    >
                      ציוד
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 600,
                        fontSize: 13,
                        color: 'var(--fs-accent-2)',
                        background: 'color-mix(in srgb, var(--fs-accent) 12%, var(--fs-surface))',
                        border: '1px solid color-mix(in srgb, var(--fs-accent) 26%, transparent)',
                        borderRadius: 'var(--radius-full)',
                        padding: '4px 12px',
                      }}
                    >
                      {equipmentLabel}
                    </span>
                  </div>
                )}

                {classificationFacts.length > 0 && (
                  <dl
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '4px 16px',
                      margin: `${hasMuscleData || equipmentLabel ? 14 : 0}px 0 0`,
                    }}
                  >
                    {classificationFacts.map((fact) => (
                      <div
                        key={fact.label}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <dt
                          style={{
                            fontFamily: 'var(--font-body)',
                            fontSize: 13,
                            color: 'var(--fs-muted)',
                          }}
                        >
                          {fact.label}
                        </dt>
                        <dd
                          style={{
                            margin: 0,
                            fontFamily: 'var(--font-body)',
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--fs-ink)',
                          }}
                        >
                          {fact.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )}

            {/* Persistent live region — announces each step on navigation. The
                visible step content remounts per step (keyed by activeStep) so it
                wouldn't announce on its own; this stable node updates instead. */}
            <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
              {currentStep
                ? `שלב ${activeStep + 1} מתוך ${currentExerciseSteps.length}${
                    currentStep.title ? `: ${currentStep.title}` : ''
                  }. ${currentStep.description}`
                : ''}
            </p>

            {currentStep && (
              <div>
                <SectionTitle>שלבי הביצוע</SectionTitle>

                {/* Segmented step spine — the ONE place the step count is stated. */}
                <div style={{ display: 'flex', gap: 4, marginBottom: 14 }} aria-hidden>
                  {currentExerciseSteps.map((s, index) => (
                    <div
                      key={`${s.title}-${s.description.slice(0, 12)}`}
                      style={{
                        flex: 1,
                        height: 4,
                        borderRadius: 'var(--radius-full)',
                        background:
                          index <= activeStep
                            ? 'var(--fs-accent)'
                            : 'color-mix(in srgb, var(--fs-steel) 70%, transparent)',
                        transition: 'background 260ms ease',
                      }}
                    />
                  ))}
                </div>

                <m.div
                  key={activeStep}
                  /* y-only: never start content at opacity 0 — a stalled animation
                     would leave the step invisible. */
                  initial={{ y: 8 }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.18 }}
                  style={card}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                    <span
                      className="tabular-nums"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        fontSize: 30,
                        color: 'var(--fs-accent-2)',
                        lineHeight: 1,
                        direction: 'ltr',
                        flexShrink: 0,
                      }}
                    >
                      {String(activeStep + 1).padStart(2, '0')}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      {currentStep.title && (
                        <h4
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 600,
                            fontSize: 18,
                            color: 'var(--fs-heading)',
                            letterSpacing: '-0.01em',
                            margin: '0 0 6px',
                          }}
                        >
                          {currentStep.title}
                        </h4>
                      )}
                      <p
                        dir="auto"
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 15,
                          color: 'var(--fs-ink)',
                          lineHeight: 1.6,
                          margin: 0,
                        }}
                      >
                        {currentStep.description}
                      </p>
                    </div>
                  </div>

                  {currentStep.tip && (
                    <div style={{ ...accentCard, marginTop: 14 }}>
                      <p
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--fs-accent-2)',
                          margin: '0 0 4px',
                        }}
                      >
                        טיפ
                      </p>
                      <p
                        dir="auto"
                        style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 14,
                          color: 'var(--fs-ink)',
                          lineHeight: 1.55,
                          margin: 0,
                        }}
                      >
                        {currentStep.tip}
                      </p>
                    </div>
                  )}
                </m.div>

                {/* Step navigation — sits directly under the step it moves. */}
                {currentExerciseSteps.length > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
                    {/* Quiet, borderless — not an outlined twin of the filled
                        button beside it. One action leads; going back is an
                        affordance, so it carries no chrome of its own. */}
                    <button
                      type="button"
                      onClick={() => setActiveStep((p) => Math.max(p - 1, 0))}
                      disabled={activeStep === 0}
                      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-1 active:scale-[0.98]"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        minHeight: 44,
                        flex: 1,
                        background: 'transparent',
                        color: 'var(--fs-muted)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        cursor: activeStep === 0 ? 'not-allowed' : 'pointer',
                        opacity: activeStep === 0 ? 0.4 : 1,
                        fontFamily: 'var(--font-display)',
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      <ChevronRight size={16} strokeWidth={2.5} />
                      הקודם
                    </button>
                    <span
                      className="tabular-nums"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 13,
                        color: 'var(--fs-muted)',
                        direction: 'ltr',
                        flexShrink: 0,
                        minWidth: 44,
                        textAlign: 'center',
                      }}
                    >
                      {activeStep + 1}/{currentExerciseSteps.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveStep((p) => Math.min(p + 1, lastStep))}
                      disabled={activeStep === lastStep}
                      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-1 active:scale-[0.98]"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        minHeight: 44,
                        flex: 1,
                        background: 'var(--fs-accent)',
                        color: 'var(--color-ink-on-accent)',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        cursor: activeStep === lastStep ? 'not-allowed' : 'pointer',
                        opacity: activeStep === lastStep ? 0.45 : 1,
                        fontFamily: 'var(--font-display)',
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      הבא
                      <ChevronLeft size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ------------------------------------------------------------- ASK */}
        {tab === 'ask' && (
          <div
            role="tabpanel"
            id="coach-panel-ask"
            aria-labelledby="coach-tab-ask"
            style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            <div>
              <label
                htmlFor="exercise-qa"
                style={{
                  display: 'block',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 14,
                  color: 'var(--fs-ink)',
                  marginBottom: 8,
                }}
              >
                מה תרצו לשאול על התרגיל?
              </label>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  color: 'var(--fs-muted)',
                  lineHeight: 1.5,
                  margin: '0 0 10px',
                }}
              >
                התשובה מבוססת על הנתונים האמיתיים שלכם בתרגיל הזה.
              </p>
              <input
                id="exercise-qa"
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAsk();
                }}
                placeholder="למשל: איזה משקל לנסות?"
                style={fieldStyle}
              />
              <button
                type="button"
                onClick={handleAsk}
                disabled={asking || !question.trim()}
                className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-1 active:scale-[0.98]"
                style={{
                  width: '100%',
                  minHeight: 46,
                  marginTop: 10,
                  background: 'var(--fs-accent)',
                  color: 'var(--color-ink-on-accent)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 15,
                  cursor: asking || !question.trim() ? 'not-allowed' : 'pointer',
                  opacity: asking || !question.trim() ? 0.5 : 1,
                }}
              >
                {asking ? 'שולח…' : 'שלחו למאמן'}
              </button>

              {answer && (
                <div style={{ ...card, marginTop: 14 }}>
                  <SectionTitle>תשובת המאמן</SectionTitle>
                  <p
                    dir="auto"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 15,
                      lineHeight: 1.65,
                      color: 'var(--fs-ink)',
                      whiteSpace: 'pre-wrap',
                      margin: 0,
                    }}
                  >
                    {answer}
                  </p>
                </div>
              )}
              {qaError && (
                <p
                  role="alert"
                  style={{
                    margin: '10px 0 0',
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: 'var(--fs-error)',
                  }}
                >
                  {qaError}
                </p>
              )}
            </div>

            {/* Generated technique reference for this movement. */}
            <div>
              <SectionTitle>טיפים לטכניקה</SectionTitle>
              {showContent && tutorialContent ? (
                <div
                  dir="auto"
                  style={{
                    ...card,
                    maxHeight: 260,
                    overflowY: 'auto',
                    fontFamily: 'var(--font-body)',
                    fontSize: 15,
                    color: 'var(--fs-ink)',
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.65,
                  }}
                >
                  {tutorialContent}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleShowTips}
                  disabled={loading}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-1 active:scale-[0.98]"
                  style={{
                    width: '100%',
                    minHeight: 46,
                    background: 'var(--fs-surface)',
                    color: 'var(--fs-ink)',
                    border: '1px solid var(--fs-steel)',
                    borderRadius: 'var(--radius-md)',
                    fontFamily: 'var(--font-display)',
                    fontWeight: 600,
                    fontSize: 15,
                    cursor: loading ? 'wait' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? 'טוען טיפים…' : 'הציגו טיפים לטכניקה'}
                </button>
              )}
              {/* AI-disclosure (EU AI Act art. 50(1)) + health disclaimer on the
                  AI-generated tips surface. */}
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 11,
                  lineHeight: 1.5,
                  color: 'var(--fs-muted)',
                  margin: '10px 0 0',
                }}
              >
                טיפים אלה מנוסחים בעזרת AI — לא ייעוץ רפואי. התאימו את העומס ליכולת שלכם.
              </p>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------ NOTE */}
        {tab === 'note' && onSaveNote && (
          <div role="tabpanel" id="coach-panel-note" aria-labelledby="coach-tab-note">
            <label
              htmlFor="exercise-note"
              style={{
                display: 'block',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 14,
                color: 'var(--fs-ink)',
                marginBottom: 8,
              }}
            >
              פתק לסט הנוכחי
            </label>
            <textarea
              id="exercise-note"
              rows={4}
              value={noteDraft}
              onChange={(e) => {
                setNoteDraft(e.target.value);
                setNoteSaved(false);
              }}
              placeholder="מה כדאי לזכור מהסט הזה?"
              style={{ ...fieldStyle, resize: 'vertical', textAlign: 'start' }}
            />

            <div style={{ marginTop: 14 }}>
              <SectionTitle>הוספה מהירה</SectionTitle>
              <div
                style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
                role="group"
                aria-label="פתקים מהירים"
              >
                {QUICK_NOTES.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleQuickNote(chip)}
                    className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-1 active:scale-[0.97]"
                    style={{
                      padding: '8px 14px',
                      minHeight: 36,
                      background: 'var(--fs-surface)',
                      border: '1px solid var(--fs-steel)',
                      borderRadius: 'var(--radius-full)',
                      color: 'var(--fs-ink)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveNote}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-1 active:scale-[0.98]"
              style={{
                width: '100%',
                minHeight: 46,
                marginTop: 18,
                background: 'var(--fs-accent)',
                color: 'var(--color-ink-on-accent)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 15,
                cursor: 'pointer',
              }}
            >
              שמירת הפתק
            </button>
            <p
              role="status"
              aria-live="polite"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'var(--fs-accent-2)',
                textAlign: 'center',
                minHeight: 20,
                margin: '8px 0 0',
              }}
            >
              {noteSaved ? 'הפתק נשמר' : ''}
            </p>
          </div>
        )}
      </div>

      <div style={{ height: 'env(safe-area-inset-bottom, 8px)', flexShrink: 0 }} />
    </div>
  );
};

export default React.memo(ExerciseTutorial);
