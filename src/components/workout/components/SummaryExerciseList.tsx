// SummaryExerciseList — polished post-workout exercise rows

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { HE_NOUNS, pluralizeHe } from '@/utils/pluralizeHe';
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
          gap: 12,
          padding: '14px 16px',
          background: isPR
            ? 'color-mix(in srgb, var(--fs-accent) 14%, var(--fs-surface))'
            : 'var(--fs-surface)',
          border: isPR
            ? '1px solid color-mix(in srgb, var(--fs-accent) 40%, transparent)'
            : '1px solid color-mix(in srgb, var(--color-border) 90%, transparent)',
          borderRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--elevation-1)',
          position: 'relative',
        }}
      >
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
              padding: '3px 10px',
              background: 'var(--fs-accent)',
              borderRadius: 9999,
              fontFamily: 'var(--font-body)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '-0.01em',
              color: 'var(--color-ink-on-accent)',
            }}
          >
            שיא
          </m.div>
        )}

        <div className="flex items-center gap-3 min-w-0">
          {isPR && (
            <CheckCircleIcon
              size={16}
              strokeWidth={2.5}
              style={{ color: 'var(--fs-accent)', flexShrink: 0 }}
            />
          )}
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 16,
              color: 'var(--fs-ink)',
              letterSpacing: '-0.015em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name || 'תרגיל ללא שם'}
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              letterSpacing: '-0.01em',
              color: 'var(--fs-muted)',
              fontWeight: 500,
            }}
          >
            {/* Hebrew keeps the noun SINGULAR for a cardinal of 1 — "סט אחד",
                never "1 סטים". pluralizeHe owns that agreement; the digit path
                (n ≠ 1) renders exactly as before. */}
            {pluralizeHe(setsCompleted, HE_NOUNS.set)}
          </span>
          {bestSet && (
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                letterSpacing: '-0.01em',
                color: 'var(--fs-ink)',
                fontWeight: 600,
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

export interface SummaryExerciseListProps {
  exercises: ExerciseSummaryItemData[];
  prExercises: Set<string>;
  maxItems?: number;
  startDelay?: number;
}

export const SummaryExerciseList: React.FC<SummaryExerciseListProps> = memo(
  ({ exercises, prExercises, maxItems, startDelay = 0 }) => {
    const displayExercises = maxItems ? exercises.slice(0, maxItems) : exercises;
    const moreCount = maxItems ? exercises.length - maxItems : 0;

    return (
      <div className="flex flex-col gap-2">
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'var(--fs-ink)',
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
        {moreCount > 0 && (
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              letterSpacing: '-0.01em',
              color: 'var(--fs-muted)',
              textAlign: 'center',
              paddingTop: 8,
              margin: 0,
            }}
          >
            {/* Noun AND adjective agree at 1 — "תרגיל נוסף", never
                "1 תרגילים נוספים". pluralizeHe can't carry the adjective, so
                the singular is spelled out; the plural branch is unchanged. */}
            {moreCount === 1 ? '+ תרגיל נוסף' : `+ ${moreCount} תרגילים נוספים`}
          </p>
        )}
      </div>
    );
  }
);

SummaryExerciseList.displayName = 'SummaryExerciseList';
