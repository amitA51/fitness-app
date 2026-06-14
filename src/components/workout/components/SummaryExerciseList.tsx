// SummaryExerciseList - Fresh Steel / Obsidian
// Sharp corners, surface cards, steel borders, Bricolage display

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { m } from 'framer-motion';
import { CheckCircle as CheckCircleIcon } from 'lucide-react';
import type React from 'react';
import { memo } from 'react';

export interface ExerciseSummaryItemData {
  name: string | undefined;
  setsCompleted: number;
  totalVolume: number;
  bestSet?: { weight: number; reps: number };
  isPR?: boolean;
}

// ============================================================
// EXERCISE ITEM
// ============================================================

interface ExerciseSummaryItemProps {
  name: string;
  setsCompleted: number;
  totalVolume: number;
  bestSet?: { weight: number; reps: number };
  isPR?: boolean;
  delay?: number;
}

const ExerciseSummaryItem: React.FC<ExerciseSummaryItemProps> = memo(
  ({ name, setsCompleted, totalVolume: _totalVolume, bestSet, isPR, delay = 0 }) => {
    const reduced = useReducedMotion();
    return (
      <m.div
        initial={reduced ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduced ? { duration: 0 } : { delay, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          background: isPR ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
          border: '2px solid var(--fs-primary)',
          position: 'relative',
        }}
      >
        {/* PR badge */}
        {isPR && (
          <m.div
            initial={reduced ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={
              reduced ? { duration: 0 } : { delay: delay + 0.2, type: 'spring', stiffness: 400 }
            }
            style={{
              position: 'absolute',
              top: -8,
              insetInlineEnd: 12,
              padding: '2px 8px',
              background: 'var(--fs-primary)',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.2em',
              color: 'var(--fs-accent)',
              textTransform: 'uppercase',
            }}
          >
            PR
          </m.div>
        )}

        <div className="flex items-center gap-3">
          {isPR && (
            <CheckCircleIcon
              size={16}
              strokeWidth={2.5}
              style={{ color: 'var(--fs-heading)', flexShrink: 0 }}
            />
          )}
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 15,
              color: isPR ? 'var(--fs-primary)' : 'var(--fs-ink)',
              letterSpacing: '-0.01em',
            }}
          >
            {name || 'תרגיל ללא שם'}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.08em',
              color: isPR ? 'var(--fs-primary)' : 'var(--fs-muted)',
              textTransform: 'uppercase',
              direction: 'ltr',
            }}
          >
            {setsCompleted} סטים
          </span>
          {bestSet && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                letterSpacing: '0.05em',
                color: isPR ? 'var(--fs-primary)' : 'var(--fs-ink)',
                fontVariantNumeric: 'tabular-nums',
                direction: 'ltr',
              }}
            >
              {bestSet.weight} ק״ג × {bestSet.reps}
            </span>
          )}
        </div>
      </m.div>
    );
  }
);
ExerciseSummaryItem.displayName = 'ExerciseSummaryItem';

// ============================================================
// SUMMARY LIST
// ============================================================

export interface SummaryExerciseListProps {
  exercises: ExerciseSummaryItemData[];
  prExercises: Set<string>;
  maxItems?: number;
  startDelay?: number;
}

export const SummaryExerciseList: React.FC<SummaryExerciseListProps> = memo(
  ({ exercises, prExercises, maxItems, startDelay = 0 }) => {
    const displayExercises = maxItems ? exercises.slice(0, maxItems) : exercises;
    const hasMore = maxItems && exercises.length > maxItems;

    return (
      <div className="flex flex-col gap-2">
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.18em',
            color: 'var(--fs-muted)',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          התרגילים
        </div>
        {displayExercises.map((ex, i) => (
          <ExerciseSummaryItem
            key={ex.name ?? ''}
            name={ex.name ?? ''}
            setsCompleted={ex.setsCompleted}
            totalVolume={ex.totalVolume}
            bestSet={ex.bestSet}
            isPR={prExercises.has(ex.name ?? '')}
            delay={startDelay + i * 0.06}
          />
        ))}
        {hasMore && (
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              color: 'var(--fs-muted)',
              textTransform: 'uppercase',
              textAlign: 'center',
              paddingTop: 8,
            }}
          >
            + {exercises.length - maxItems!} תרגילים נוספים
          </p>
        )}
      </div>
    );
  }
);

SummaryExerciseList.displayName = 'SummaryExerciseList';
