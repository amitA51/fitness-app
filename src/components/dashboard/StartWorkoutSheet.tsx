import { ChevronLeft, Dumbbell, LayoutList, RotateCcw, Sparkles } from 'lucide-react';
import { type ReactNode, memo } from 'react';
import { useIsRTL } from '../../hooks/useIsRTL';
import type { WorkoutTemplate } from '../../types';
import { Stagger, StaggerItem } from '../motion/Stagger';
import { Sheet } from '../ui/Sheet';

interface StartWorkoutSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Most-recently used template, when one exists — enables the "continue" option. */
  lastUsedTemplate: WorkoutTemplate | null;
  /** Repeat the last-used template. */
  onContinueLast: () => void;
  /** Open the template library to pick one. */
  onPickTemplate: () => void;
  /** Start a blank workout with no template. */
  onEmptyWorkout: () => void;
}

interface StartOptionProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  /** Optional badge above the title (e.g. "מומלץ"). */
  badge?: string;
  accent?: boolean;
  onClick: () => void;
}

const StartOption = memo(function StartOption({
  icon,
  title,
  subtitle,
  badge,
  accent = false,
  onClick,
}: StartOptionProps) {
  const isRTL = useIsRTL();
  return (
    <button
      type="button"
      onClick={onClick}
      className="choice-row focus-ring"
      data-accent={accent ? 'true' : undefined}
    >
      <span className="choice-row-icon" aria-hidden="true">
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 3 }}>
        {badge && (
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              color: accent ? 'var(--fs-accent-2)' : 'var(--fs-muted)',
            }}
          >
            {badge}
          </span>
        )}
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 17,
            color: 'var(--fs-heading)',
            letterSpacing: '-0.015em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--fs-muted)',
            letterSpacing: '-0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {subtitle}
        </span>
      </span>
      <ChevronLeft
        size={18}
        aria-hidden="true"
        style={{
          flexShrink: 0,
          color: accent ? 'var(--fs-accent-2)' : 'var(--fs-muted)',
          transform: isRTL ? undefined : 'rotate(180deg)',
        }}
      />
    </button>
  );
});

/**
 * The single entry point for starting a workout from the dashboard.
 * First-run clarity: when there is no last-used template, "בחר תבנית" is the
 * accent/recommended path. Empty workout is secondary.
 */
export const StartWorkoutSheet = memo(function StartWorkoutSheet({
  isOpen,
  onClose,
  lastUsedTemplate,
  onContinueLast,
  onPickTemplate,
  onEmptyWorkout,
}: StartWorkoutSheetProps) {
  const hasLast = Boolean(lastUsedTemplate);

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="התחל אימון">
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          lineHeight: 1.5,
          letterSpacing: '-0.01em',
          color: 'var(--fs-muted)',
          margin: '0 0 16px',
          textAlign: 'start',
        }}
      >
        {hasLast
          ? 'בחרו איך להתחיל — מומלץ להמשיך מהתבנית האחרונה.'
          : 'מומלץ לבחור תבנית מוכנה עם תרגילים. אימון ריק מתאים אם אתם יודעים בדיוק מה תרצו.'}
      </p>

      <Stagger stagger={0.05} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {lastUsedTemplate && (
          <StaggerItem>
            <StartOption
              accent
              badge="מומלץ"
              icon={<RotateCcw size={20} strokeWidth={2} aria-hidden="true" />}
              title={`המשך · ${lastUsedTemplate.name}`}
              subtitle="התבנית האחרונה שלכם"
              onClick={onContinueLast}
            />
          </StaggerItem>
        )}
        <StaggerItem>
          <StartOption
            accent={!hasLast}
            badge={!hasLast ? 'מומלץ למתחילים' : undefined}
            icon={
              !hasLast ? (
                <Sparkles size={20} strokeWidth={2} aria-hidden="true" />
              ) : (
                <LayoutList size={20} strokeWidth={2} aria-hidden="true" />
              )
            }
            title="בחרו תבנית מוכנה"
            subtitle="תרגילים מוכנים מראש — פשוט להתחיל"
            onClick={onPickTemplate}
          />
        </StaggerItem>
        <StaggerItem>
          <StartOption
            icon={<Dumbbell size={20} strokeWidth={2} aria-hidden="true" />}
            title="אימון ריק"
            subtitle="הוסיפו תרגילים תוך כדי — למתקדמים"
            onClick={onEmptyWorkout}
          />
        </StaggerItem>
      </Stagger>
    </Sheet>
  );
});

export default StartWorkoutSheet;
