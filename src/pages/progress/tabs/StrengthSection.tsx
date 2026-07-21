// ============================================================================
// StrengthSection — the "כוח" area of the Workouts tab.
// ============================================================================
// Reworked from four always-on stacked cards into a master → detail flow:
//
//   LIST (the "big picture"): a one-line verdict, sort + status filters, and a
//   scannable row per exercise (current e1RM, trend, recency, sparkline). Below
//   it, the personal-records board + full PR history as secondary "records".
//
//   DETAIL (on tap): <ExerciseDetail> — the honest e1RM hero, a note on how the
//   number is derived, the trend curve, the weekly forecast, and per-session
//   history. Progressive disclosure (state-driven, no modal) keeps the default
//   view calm while every detail stays one tap away.
//
// The metric is estimated 1RM of the best working set per session (warmups
// excluded) — one comparable number whether you went heavier-for-fewer or
// lighter-for-more, which is the honest answer to "am I getting stronger?".

import { AnimatePresence, m } from 'framer-motion';
import { Dumbbell, ChevronDown } from 'lucide-react';
import type React from 'react';
import { memo, useEffect, useMemo, useState } from 'react';
import PRHistoryTab from '../../../components/workout/PRHistoryTab';
import { useReducedMotion } from '../../../hooks/useReducedMotion';
import type { PersonalRecord, WorkoutSession } from '../../../types';
import { ChartSummary, ChartSummaryNumber } from '../components/ChartSummary';
import { ExerciseDetail } from '../components/ExerciseDetail';
import { ExerciseProgressRow } from '../components/ExerciseProgressRow';
import { SectionCard } from '../components/SectionCard';
import {
  STRENGTH_FILTER_LABEL,
  STRENGTH_SORT_LABEL,
  type StrengthFilter,
  type StrengthSort,
  type StrengthSummary,
  buildExerciseProgress,
  buildPRBoard,
  filterExerciseProgress,
  sortExerciseProgress,
  strengthFilterCount,
  summarizeStrength,
} from '../progressMetrics';
import { exerciseLabel } from '../strengthFormat';

const FILTER_ORDER: StrengthFilter[] = ['all', 'improving', 'stalled', 'dormant'];
const SORT_ORDER: StrengthSort[] = ['recent', 'improved', 'heaviest', 'alpha'];
const PR_BOARD_COLLAPSED = 5;

const kicker: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.15em',
  color: 'var(--fs-muted)',
};

/** One-line, zone-tinted takeaway for the whole strength picture. */
function StrengthVerdict({ summary }: { summary: StrengthSummary }) {
  const { tracked, improving, stalled } = summary;
  if (improving > 0) {
    return (
      <ChartSummary kicker="כוח · סיכום">
        מתוך <ChartSummaryNumber value={tracked} /> תרגילים במעקב,{' '}
        <ChartSummaryNumber value={improving} zone="good" /> במגמת שיפור.
      </ChartSummary>
    );
  }
  if (stalled > 0) {
    return (
      <ChartSummary kicker="כוח · סיכום">
        <ChartSummaryNumber value={stalled} zone="attention" /> תרגילים תקועים — כדאי להעלות משקל או
        חזרות באימון הבא.
      </ChartSummary>
    );
  }
  return (
    <ChartSummary kicker="כוח · סיכום">
      <ChartSummaryNumber value={tracked} /> תרגילים במעקב. עוד כמה אימונים ותהיה תמונת מגמה ברורה.
    </ChartSummary>
  );
}

/** A single sort/filter pill. */
function Chip({
  active,
  onClick,
  ariaPressed,
  children,
}: {
  active: boolean;
  onClick: () => void;
  ariaPressed: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={ariaPressed}
      onClick={onClick}
      className="shrink-0 active:scale-[0.97] motion-reduce:active:scale-100"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        minHeight: 40,
        paddingInline: 14,
        border: 'none',
        borderRadius: 999,
        cursor: 'pointer',
        background: active ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
        color: active ? 'var(--color-ink-on-accent)' : 'var(--fs-ink)',
        fontFamily: 'var(--font-hebrew)',
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        transition: 'background 0.15s, color 0.15s, transform 0.1s',
      }}
    >
      {children}
    </button>
  );
}

export const StrengthSection = memo(function StrengthSection({
  sessions,
  prs,
}: {
  // Already status-filtered to completed by the parent (single data source).
  sessions: WorkoutSession[];
  prs: PersonalRecord[];
}) {
  const reduced = useReducedMotion();
  const progress = useMemo(() => buildExerciseProgress(sessions), [sessions]);
  const summary = useMemo(() => summarizeStrength(progress), [progress]);
  const prBoard = useMemo(() => buildPRBoard(prs), [prs]);

  const [selected, setSelected] = useState<string | null>(null);
  const [sort, setSort] = useState<StrengthSort>('recent');
  const [filter, setFilter] = useState<StrengthFilter>('all');
  const [showAllPRs, setShowAllPRs] = useState(false);
  const [isPRBoardOpen, setIsPRBoardOpen] = useState(false);

  const visible = useMemo(
    () => sortExerciseProgress(filterExerciseProgress(progress, filter), sort),
    [progress, filter, sort]
  );

  const selectedProgress = useMemo(
    () => (selected ? (progress.find((p) => p.exerciseName === selected) ?? null) : null),
    [selected, progress]
  );

  // If the selected exercise disappears (e.g. data reload), fall back to the list.
  useEffect(() => {
    if (selected && !progress.some((p) => p.exerciseName === selected)) setSelected(null);
  }, [selected, progress]);

  // ── Fully empty: no strength points and no PRs ──────────────────────────────
  if (progress.length === 0 && prBoard.length === 0) {
    return (
      <SectionCard rail={false} style={{ padding: 20 }}>
        <div className="flex flex-col items-center py-12 text-center gap-3">
          <Dumbbell size={36} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />
          <p
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--fs-ink)',
            }}
          >
            אין נתוני כוח עדיין
          </p>
          <p style={{ fontFamily: 'var(--font-hebrew)', fontSize: 13, color: 'var(--fs-muted)' }}>
            השלימו אימונים עם משקלים כדי לעקוב אחרי ההתקדמות בכל תרגיל.
          </p>
        </div>
      </SectionCard>
    );
  }

  const easeOut: [number, number, number, number] = [0.16, 1, 0.3, 1];
  const transition = reduced ? { duration: 0 } : { duration: 0.18, ease: easeOut };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {selectedProgress ? (
        <m.div
          key="detail"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
        >
          <ExerciseDetail
            progress={selectedProgress}
            sessions={sessions}
            onBack={() => setSelected(null)}
          />
        </m.div>
      ) : (
        <m.div
          key="list"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={transition}
          className="space-y-4"
        >
          {progress.length > 0 ? (
            <>
              <StrengthVerdict summary={summary} />

              {/* Filters — status buckets with live counts (empty buckets hidden). */}
              <div
                role="group"
                aria-label="סינון תרגילים"
                className="flex gap-2 overflow-x-auto"
                style={{ scrollbarWidth: 'none', paddingBottom: 2 }}
              >
                {FILTER_ORDER.map((f) => {
                  const count = strengthFilterCount(summary, f);
                  if (f !== 'all' && count === 0) return null;
                  const active = filter === f;
                  return (
                    <Chip key={f} active={active} ariaPressed={active} onClick={() => setFilter(f)}>
                      {STRENGTH_FILTER_LABEL[f]}
                      <span
                        dir="ltr"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 11,
                          fontWeight: 700,
                          color: active ? 'var(--color-ink-on-accent)' : 'var(--fs-muted)',
                        }}
                      >
                        {count}
                      </span>
                    </Chip>
                  );
                })}
              </div>

              {/* Sort */}
              <div
                role="group"
                aria-label="מיון תרגילים"
                className="flex items-center gap-2 overflow-x-auto"
                style={{ scrollbarWidth: 'none', paddingBottom: 2 }}
              >
                <span style={{ ...kicker, flexShrink: 0 }}>מיון</span>
                {SORT_ORDER.map((s) => {
                  const active = sort === s;
                  return (
                    <Chip key={s} active={active} ariaPressed={active} onClick={() => setSort(s)}>
                      {STRENGTH_SORT_LABEL[s]}
                    </Chip>
                  );
                })}
              </div>

              {/* The scannable master list */}
              {visible.length > 0 ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {visible.map((p) => (
                    <ExerciseProgressRow
                      key={p.exerciseName}
                      progress={p}
                      onOpen={() => setSelected(p.exerciseName)}
                    />
                  ))}
                </div>
              ) : (
                <p
                  style={{
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: 13,
                    color: 'var(--fs-muted)',
                    textAlign: 'center',
                    padding: '16px 0',
                  }}
                >
                  אין תרגילים בקטגוריה הזו.
                </p>
              )}
            </>
          ) : (
            <SectionCard rail={false} style={{ padding: 20 }}>
              <p
                style={{
                  fontFamily: 'var(--font-hebrew)',
                  fontSize: 13,
                  color: 'var(--fs-muted)',
                  textAlign: 'center',
                }}
              >
                עוד לא נצברו מספיק נתונים למגמות כוח — השיאים שלכם למטה.
              </p>
            </SectionCard>
          )}

          {/* ── Records: PR leaderboard + full PR history (secondary) ──────────── */}
          {prBoard.length > 0 && (
            <SectionCard rail={false} style={{ padding: '16px 20px' }}>
              <button
                type="button"
                onClick={() => setIsPRBoardOpen((o) => !o)}
                className="flex items-center justify-between w-full outline-none"
                style={{ 
                  background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                  marginBottom: isPRBoardOpen ? 12 : 0
                }}
              >
                <div className="flex items-baseline gap-2">
                  <h3 style={kicker}>שיאים אישיים · PR</h3>
                  <span style={{ ...kicker, fontSize: 9 }} dir="ltr">
                    {prBoard.length}
                  </span>
                </div>
                <ChevronDown
                  size={16}
                  style={{
                    color: 'var(--fs-muted)',
                    transform: isPRBoardOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s ease',
                  }}
                />
              </button>

              <AnimatePresence>
                {isPRBoardOpen && (
                  <m.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ display: 'grid', gap: 6 }}>
                {(showAllPRs ? prBoard : prBoard.slice(0, PR_BOARD_COLLAPSED)).map((entry, i) => (
                  <div
                    key={entry.exerciseName}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '8px 12px',
                      background:
                        i === 0
                          ? 'color-mix(in srgb, var(--fs-accent) 12%, var(--fs-surface))'
                          : 'var(--fs-surface-2)',
                      borderRadius: 10,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          fontWeight: 700,
                          color: i === 0 ? 'var(--fs-accent)' : 'var(--fs-muted)',
                          width: 18,
                        }}
                        dir="ltr"
                      >
                        #{i + 1}
                      </span>
                      <span
                        className="line-clamp-1"
                        style={{
                          fontFamily: 'var(--font-hebrew)',
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--fs-ink)',
                        }}
                      >
                        {exerciseLabel(entry.exerciseName)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexShrink: 0 }}>
                      <span
                        className="kinetic-number"
                        dir="ltr"
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontWeight: 600,
                          fontSize: 18,
                          color: 'var(--fs-ink)',
                        }}
                      >
                        {entry.e1RM}
                      </span>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          fontWeight: 700,
                          color: 'var(--fs-muted)',
                        }}
                      >
                        1RM
                      </span>
                      <span
                        dir="ltr"
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          fontWeight: 600,
                          color: 'var(--fs-muted)',
                          marginInlineStart: 4,
                        }}
                      >
                        {entry.weight}×{entry.reps}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {prBoard.length > PR_BOARD_COLLAPSED && (
                <button
                  type="button"
                  onClick={() => setShowAllPRs((v) => !v)}
                  aria-expanded={showAllPRs}
                  className="active:scale-[0.98] motion-reduce:active:scale-100"
                  style={{
                    marginTop: 10,
                    width: '100%',
                    minHeight: 44,
                    background: 'transparent',
                    border: '1px solid var(--fs-surface-2)',
                    borderRadius: 10,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--fs-accent)',
                  }}
                >
                  {showAllPRs ? (
                    'הצג פחות'
                  ) : (
                    <>
                      הצג הכל · <span dir="ltr">+{prBoard.length - PR_BOARD_COLLAPSED}</span>
                    </>
                  )}
                </button>
              )}
                  </m.div>
                )}
              </AnimatePresence>
            </SectionCard>
          )}

          <PRHistoryTab />
        </m.div>
      )}
    </AnimatePresence>
  );
});

export default StrengthSection;
