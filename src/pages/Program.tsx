/**
 * Program page — the built-in 12-week "Bodybuilding Transformation System"
 * presented as a guided, self-paced program. Shows the current week/day, lets
 * the trainee start the day's workout (which seeds the runner with the exact
 * sets/reps/RPE/technique/substitutions for that week), browse all weeks grouped
 * by mesocycle block, and tracks completion as they advance.
 *
 * Design contract: tokens only (no hardcoded hex), mint --fs-accent for action,
 * lime --fs-signal for celebration, --fs-surface-2 hairline borders (visible in
 * both Fresh Steel + Obsidian), editorial mono-kicker + display masthead idiom,
 * RTL bidi-isolation on composite numerals, and reduced-motion honored.
 */

import { m } from 'framer-motion';
import { Check, ChevronDown, Dumbbell, PartyPopper, Play, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Stagger, StaggerItem } from '../components/motion/Stagger';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { BBT_PROGRAM, type BbtDay } from '../data/bbtProgram.generated';
import { useReducedMotion } from '../hooks/useReducedMotion';
import {
  TRAINING_DAYS,
  type TrainingDay,
  enDashRange,
  getBlockForWeek,
  getExerciseOptions,
  getProgramDay,
  getProgress,
  getSwaps,
  resetProgram,
  restRangeHe,
  setSwap,
  startProgram,
  startProgramDay,
} from '../services/programService';
import { ensurePersistentStorage } from '../services/storagePersistence';

const TOTAL_DAYS = BBT_PROGRAM.totalWeeks * TRAINING_DAYS.length;
const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export default function Program() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [progress, setProgress] = useState(() => startProgram());
  const [selectedWeek, setSelectedWeek] = useState<number>(() => progress.currentWeek);
  const [expanded, setExpanded] = useState<TrainingDay | null>(null);
  const [starting, setStarting] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [swaps, setSwaps] = useState<Record<string, string>>(() => getSwaps());

  // Persist a movement substitution for one day-slot, then re-read so the card
  // (and the next start of that day) reflects the choice. `choice === null`
  // restores the original movement.
  const handleSwap = useCallback(
    (week: number, dayType: TrainingDay, order: number, choice: string | null) => {
      setSwap(week, dayType, order, choice);
      setSwaps(getSwaps());
    },
    []
  );

  // Re-read progress when returning to the page (e.g. after finishing a workout,
  // the reconcile in the save flow advances the pointer).
  useEffect(() => {
    const refresh = () => {
      const p = getProgress();
      if (p) setProgress(p);
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const completedSet = useMemo(
    () => new Set(progress.completed.map((c) => `${c.week}-${c.dayType}`)),
    [progress.completed]
  );

  const currentDayType = TRAINING_DAYS[progress.currentDayIndex] ?? 'Upper';
  const block = getBlockForWeek(selectedWeek);
  const isDone = (week: number, dt: TrainingDay) => completedSet.has(`${week}-${dt}`);

  const handleStart = useCallback(
    async (week: number, dayType: TrainingDay) => {
      if (starting) return;
      setStarting(true);
      // Durability: the trainee just committed to a program day by a real tap —
      // the right moment to ask the browser to keep our offline storage from
      // being evicted over the 12-week haul. Best-effort, never blocks the start.
      void ensurePersistentStorage();
      try {
        const id = await startProgramDay(week, dayType);
        if (id) navigate(`/workout/${id}`);
        else setStarting(false);
      } catch {
        setStarting(false);
      }
    },
    [navigate, starting]
  );

  const handleReset = () => {
    resetProgram();
    const fresh = startProgram();
    setProgress(fresh);
    setSelectedWeek(fresh.currentWeek);
    setExpanded(null);
    setSwaps(getSwaps());
    setShowReset(false);
  };

  const pct = Math.round((completedSet.size / TOTAL_DAYS) * 100);

  return (
    <div
      dir="rtl"
      lang="he"
      className="pb-[96px]"
      style={{ background: 'var(--fs-bg)', color: 'var(--fs-ink)', minHeight: '100dvh' }}
    >
      <Stagger>
        <StaggerItem>
          {/* Editorial masthead — mono kicker + display title */}
          <header
            style={{
              padding: 'max(20px, env(safe-area-inset-top, 20px)) 20px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '-0.01em',
                color: 'var(--fs-accent-2)',
              }}
            >
              {BBT_PROGRAM.level} · {BBT_PROGRAM.totalWeeks} שבועות
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: 'clamp(30px, 8.5vw, 46px)',
                lineHeight: 0.95,
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              {BBT_PROGRAM.titleHe}
            </h1>
            <p style={{ color: 'var(--fs-muted)', fontSize: 14, margin: '2px 0 0' }}>
              5 אימונים בשבוע · התקדמות מודרכת לפי RPE
            </p>
            {/* Progress bar */}
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 12,
                  color: 'var(--fs-muted)',
                  marginBottom: 4,
                }}
              >
                <span>
                  <bdi dir="ltr">
                    {completedSet.size}/{TOTAL_DAYS}
                  </bdi>{' '}
                  אימונים הושלמו
                </span>
                <span dir="ltr">{pct}%</span>
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 999,
                  background: 'var(--fs-surface-2)',
                  overflow: 'hidden',
                  // Fill grows left→right (week 1 → 12), matching the SetProgress
                  // spine. Without this, the RTL page fills the bar from the right,
                  // which reads as "backwards" for a forward-time progression.
                  direction: 'ltr',
                }}
              >
                <m.div
                  // scaleX instead of width: width animation is a layout-driving
                  // property, scaleX is composited. The track is `direction: ltr`
                  // above, so the origin is the left edge in both locales.
                  initial={reduceMotion ? false : { scaleX: 0 }}
                  animate={{ scaleX: pct / 100 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: EASE_OUT }}
                  style={{
                    height: '100%',
                    width: '100%',
                    transformOrigin: 'left center',
                    background: 'linear-gradient(90deg, var(--fs-accent), var(--fs-accent-2))',
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
          </header>
        </StaggerItem>

        <StaggerItem>
          {/* Continue / current-day hero */}
          {progress.status === 'active' ? (
            <ContinueCard
              week={progress.currentWeek}
              dayType={currentDayType}
              starting={starting}
              onStart={() => handleStart(progress.currentWeek, currentDayType)}
            />
          ) : (
            <div
              style={{
                margin: '12px 20px',
                padding: 20,
                borderRadius: 18,
                background: 'var(--fs-signal)',
                color: 'var(--color-ink-on-accent)',
                textAlign: 'center',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                boxShadow: 'var(--shadow-glow-signal)',
              }}
            >
              <PartyPopper size={20} aria-hidden />
              סיימת את כל {BBT_PROGRAM.totalWeeks} השבועות! כל הכבוד.
            </div>
          )}
        </StaggerItem>

        <StaggerItem>
          {/* Week selector — grouped by mesocycle block */}
          <section
            style={{ padding: '10px 20px 0', display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            {BBT_PROGRAM.blocks.map((b) => {
              const first = b.weeks[0];
              const last = b.weeks[b.weeks.length - 1];
              return (
                <div key={b.name}>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '-0.01em',
                      color: 'var(--fs-muted)',
                      marginBottom: 8,
                    }}
                  >
                    {b.nameHe} · שבועות{' '}
                    <bdi dir="ltr">
                      {first}–{last}
                    </bdi>
                  </div>
                  {/* direction:ltr so the numeric week progression reads 1→12
                  left→right. Under the page's RTL the digits would otherwise
                  flow right→left and scan as "end to beginning". */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, direction: 'ltr' }}>
                    {b.weeks.map((w) => {
                      const active = w === selectedWeek;
                      const isCurrent = w === progress.currentWeek;
                      return (
                        <button
                          key={w}
                          type="button"
                          onClick={() => {
                            setSelectedWeek(w);
                            setExpanded(null);
                          }}
                          style={{
                            flex: '0 0 auto',
                            minWidth: 48,
                            height: 44,
                            borderRadius: 12,
                            border: isCurrent
                              ? '2px solid var(--fs-accent)'
                              : '1px solid var(--fs-surface-2)',
                            background: active ? 'var(--fs-accent)' : 'transparent',
                            color: active ? 'var(--color-ink-on-accent)' : 'var(--fs-ink)',
                            fontWeight: 700,
                            fontSize: 14,
                            cursor: 'pointer',
                          }}
                          aria-pressed={active}
                          aria-label={`שבוע ${w}${isCurrent ? ' · השבוע הנוכחי' : ''}`}
                        >
                          <span dir="ltr">{w}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        </StaggerItem>

        <StaggerItem>
          {/* Days of the selected week */}
          <section
            style={{ padding: '14px 20px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <div style={{ color: 'var(--fs-muted)', fontSize: 13, marginBottom: 2 }}>
              שבוע {selectedWeek} · {block.nameHe}
            </div>
            {TRAINING_DAYS.map((dt) => {
              const day = getProgramDay(selectedWeek, dt);
              if (!day) return null;
              return (
                <DayCard
                  key={dt}
                  day={day}
                  week={selectedWeek}
                  swaps={swaps}
                  done={isDone(selectedWeek, dt)}
                  isCurrent={selectedWeek === progress.currentWeek && dt === currentDayType}
                  expanded={expanded === dt}
                  starting={starting}
                  onToggle={() => setExpanded((e) => (e === dt ? null : dt))}
                  onStart={() => handleStart(selectedWeek, dt)}
                  onSwap={(order, choice) => handleSwap(selectedWeek, dt, order, choice)}
                />
              );
            })}
          </section>
        </StaggerItem>
      </Stagger>

      {/* Reset */}
      <div style={{ padding: '8px 20px 16px', display: 'flex', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => setShowReset(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            minHeight: 44,
            padding: '10px 14px',
            background: 'transparent',
            border: 'none',
            color: 'var(--fs-muted)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          <RotateCcw size={14} aria-hidden /> אפס את ההתקדמות בתוכנית
        </button>
      </div>

      <ConfirmDialog
        isOpen={showReset}
        title="לאפס את התוכנית?"
        description="כל ההתקדמות בתוכנית (אילו אימונים סומנו כהושלמו) תימחק. האימונים השמורים שלך לא יושפעו."
        confirmLabel="אפס"
        variant="warning"
        cancelLabel="ביטול"
        onConfirm={handleReset}
        onCancel={() => setShowReset(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function ContinueCard({
  week,
  dayType,
  starting,
  onStart,
}: {
  week: number;
  dayType: TrainingDay;
  starting: boolean;
  onStart: () => void;
}) {
  const day = getProgramDay(week, dayType);
  if (!day) return null;
  return (
    <div
      style={{
        margin: '14px 20px 4px',
        padding: 18,
        borderRadius: 18,
        border: '1px solid var(--fs-surface-2)',
        background: 'var(--fs-surface)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '-0.01em',
            color: 'var(--fs-accent-2)',
            marginBottom: 4,
          }}
        >
          האימון הבא שלך
        </div>
        <div style={{ fontSize: 18, fontWeight: 800 }}>
          שבוע {week} · {day.dayHe}
        </div>
        <div style={{ color: 'var(--fs-muted)', fontSize: 13, marginTop: 2 }}>
          {day.exercises.length} תרגילים · {day.blockHe}
        </div>
      </div>
      <button
        type="button"
        onClick={onStart}
        disabled={starting}
        className="start-workout-btn active:scale-[0.98]"
        style={{
          minHeight: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          opacity: starting ? 0.7 : 1,
        }}
      >
        <Play size={18} aria-hidden fill="currentColor" />
        {starting ? 'מתחיל…' : 'התחל את האימון'}
      </button>
    </div>
  );
}

function DayCard({
  day,
  week,
  swaps,
  done,
  isCurrent,
  expanded,
  starting,
  onToggle,
  onStart,
  onSwap,
}: {
  day: BbtDay;
  week: number;
  swaps: Record<string, string>;
  done: boolean;
  isCurrent: boolean;
  expanded: boolean;
  starting: boolean;
  onToggle: () => void;
  onStart: () => void;
  onSwap: (order: number, choice: string | null) => void;
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: isCurrent ? '2px solid var(--fs-accent)' : '1px solid var(--fs-surface-2)',
        background: 'var(--fs-surface)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          color: 'var(--fs-ink)',
          cursor: 'pointer',
          textAlign: 'start',
        }}
        aria-expanded={expanded}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 auto',
            background: done ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
            color: done ? 'var(--color-ink-on-accent)' : 'var(--fs-muted)',
          }}
        >
          {done ? <Check size={16} aria-hidden /> : <Dumbbell size={15} aria-hidden />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{day.dayHe}</div>
          <div style={{ color: 'var(--fs-muted)', fontSize: 12 }}>
            {day.exercises.length} תרגילים{done ? ' · הושלם' : ''}
          </div>
        </div>
        <ChevronDown
          size={18}
          aria-hidden
          style={{
            color: 'var(--fs-muted)',
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}
        />
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {day.exercises.map((ex) => {
              const options = getExerciseOptions(ex);
              const original = options[0];
              const chosenLabel =
                swaps[`${week}-${day.dayType}-${ex.order}`] ?? original?.label ?? ex.nameHe;
              const chosen = options.find((o) => o.label === chosenLabel) ?? original;
              const chosenHe = chosen?.he ?? ex.nameHe;
              const chosenEn = chosenLabel.includes('|')
                ? (chosenLabel.split('|').pop() ?? '').trim()
                : chosenLabel;
              const isSwapped = chosenLabel !== (original?.label ?? chosenLabel);
              return (
                <li
                  key={ex.order}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    background: 'var(--fs-surface-2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      alignItems: 'baseline',
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: 14 }}>
                      {chosenHe}
                      {isSwapped && (
                        <span
                          style={{
                            marginInlineStart: 6,
                            fontFamily: 'var(--font-mono)',
                            fontSize: 9.5,
                            fontWeight: 700,
                            letterSpacing: '0.1em',
                            color: 'var(--fs-accent-2)',
                          }}
                        >
                          הוחלף
                        </span>
                      )}
                    </span>
                    <span
                      style={{
                        color: 'var(--fs-accent-2)',
                        fontSize: 13,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <bdi dir="ltr">
                        {ex.workingSets}×{enDashRange(ex.reps)}
                      </bdi>
                    </span>
                  </div>
                  <div
                    style={{
                      color: 'var(--fs-muted)',
                      fontSize: 12,
                      marginTop: 3,
                      direction: 'ltr',
                      textAlign: 'right',
                    }}
                  >
                    {chosenEn}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    <Tag>
                      <bdi dir="ltr">
                        RPE {ex.earlyRpe}→{ex.lastRpe}
                      </bdi>
                    </Tag>
                    <Tag>
                      מנוחה <bdi dir="ltr">{restRangeHe(ex.rest)}</bdi>
                    </Tag>
                    {ex.techniqueHe ? <Tag accent>{ex.techniqueHe}</Tag> : null}
                  </div>
                  {options.length > 1 && (
                    <div style={{ marginTop: 8 }}>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9.5,
                          letterSpacing: '-0.01em',
                          color: 'var(--fs-muted)',
                          marginBottom: 5,
                        }}
                      >
                        החלפת תרגיל
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {options.map((opt, oi) => {
                          const active = opt.label === chosenLabel;
                          return (
                            <button
                              key={opt.label}
                              type="button"
                              onClick={() => onSwap(ex.order, oi === 0 ? null : opt.label)}
                              aria-pressed={active}
                              style={{
                                fontSize: 11.5,
                                fontWeight: 600,
                                padding: '7px 11px',
                                minHeight: 36,
                                borderRadius: 999,
                                cursor: 'pointer',
                                border: active
                                  ? '1px solid var(--fs-accent)'
                                  : '1px solid var(--fs-surface)',
                                background: active ? 'var(--fs-accent)' : 'var(--fs-surface)',
                                color: active ? 'var(--color-ink-on-accent)' : 'var(--fs-ink)',
                              }}
                            >
                              {opt.he}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={onStart}
            disabled={starting}
            className="start-workout-btn active:scale-[0.98]"
            style={{
              marginTop: 14,
              width: '100%',
              minHeight: 46,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: starting ? 0.7 : 1,
            }}
          >
            <Play size={16} aria-hidden fill="currentColor" />
            התחל אימון זה
          </button>
        </div>
      )}
    </div>
  );
}

function Tag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        background: accent ? 'var(--fs-accent)' : 'var(--fs-surface)',
        color: accent ? 'var(--color-ink-on-accent)' : 'var(--fs-muted)',
      }}
    >
      {children}
    </span>
  );
}
