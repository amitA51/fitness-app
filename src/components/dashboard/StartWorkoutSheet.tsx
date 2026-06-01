import { ChevronLeft, Dumbbell, LayoutList, RotateCcw } from 'lucide-react';
import { type ReactNode, memo } from 'react';
import { useIsRTL } from '../../hooks/useIsRTL';
import type { WorkoutTemplate } from '../../types';
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
  accent?: boolean;
  onClick: () => void;
}

const StartOption = memo(function StartOption({
  icon,
  title,
  subtitle,
  accent = false,
  onClick,
}: StartOptionProps) {
  const isRTL = useIsRTL();
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-ring magnetic-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        minHeight: 64,
        padding: '14px 16px',
        textAlign: 'start',
        cursor: 'pointer',
        background: accent
          ? 'color-mix(in srgb, var(--fs-accent) 12%, var(--fs-surface))'
          : 'var(--fs-surface)',
        border: `1px solid ${accent ? 'var(--fs-accent)' : 'var(--fs-surface-2)'}`,
        borderRadius: 'var(--radius-asymmetric)',
        color: 'var(--fs-ink)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          flexShrink: 0,
          borderRadius: 14,
          background: accent ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
          color: accent ? 'var(--color-ink-on-accent)' : 'var(--fs-accent)',
        }}
      >
        {icon}
      </span>
      <span style={{ flex: 1, minWidth: 0, display: 'grid', gap: 2 }}>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 16,
            color: 'var(--fs-heading)',
            letterSpacing: '-0.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--fs-muted)',
            letterSpacing: '0.04em',
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
          color: 'var(--fs-muted)',
          transform: isRTL ? undefined : 'rotate(180deg)',
        }}
      />
    </button>
  );
});

/**
 * The single entry point for starting a workout from the dashboard. Folds the
 * three former start affordances (primary CTA, "empty workout", "repeat last")
 * into one choice surface so the dashboard exposes exactly one primary CTA.
 */
export const StartWorkoutSheet = memo(function StartWorkoutSheet({
  isOpen,
  onClose,
  lastUsedTemplate,
  onContinueLast,
  onPickTemplate,
  onEmptyWorkout,
}: StartWorkoutSheetProps) {
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="התחל אימון">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lastUsedTemplate && (
          <StartOption
            accent
            icon={<RotateCcw size={20} aria-hidden="true" />}
            title={`המשך · ${lastUsedTemplate.name}`}
            subtitle="התבנית האחרונה שלך"
            onClick={onContinueLast}
          />
        )}
        <StartOption
          icon={<LayoutList size={20} aria-hidden="true" />}
          title="בחר תבנית"
          subtitle="התחל מתוך ספריית התבניות"
          onClick={onPickTemplate}
        />
        <StartOption
          icon={<Dumbbell size={20} aria-hidden="true" />}
          title="אימון ריק"
          subtitle="הוסף תרגילים תוך כדי"
          onClick={onEmptyWorkout}
        />
      </div>
    </Sheet>
  );
});

export default StartWorkoutSheet;
