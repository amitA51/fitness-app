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
      className="focus-ring magnetic-card active:scale-[0.98]"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        minHeight: 64,
        padding: '14px 16px',
        textAlign: 'start',
        cursor: 'pointer',
        // The recommended / accent row gets a stronger ~20% accent wash + a
        // 2px accent border so it reads as the pre-selected default.
        background: accent
          ? 'color-mix(in srgb, var(--fs-accent) 20%, var(--fs-surface))'
          : 'var(--fs-surface)',
        border: accent ? '2px solid var(--fs-accent)' : '1px solid var(--fs-surface-2)',
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
        {badge && (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: accent ? 'var(--fs-accent)' : 'var(--fs-muted)',
            }}
          >
            {badge}
          </span>
        )}
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
 *
 * First-run clarity: when there is no last-used template, "בחר תבנית" is the
 * accent/recommended path (ready exercises). Empty workout is secondary.
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
      {/* Short orientation line — answers "what should I pick?" before options. */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          lineHeight: 1.45,
          color: 'var(--fs-muted)',
          margin: '0 0 14px',
          textAlign: 'start',
        }}
      >
        {hasLast
          ? 'בחרו איך להתחיל — מומלץ להמשיך מהתבנית האחרונה.'
          : 'מומלץ לבחור תבנית מוכנה עם תרגילים. אימון ריק מתאים אם אתם יודעים בדיוק מה תרצו.'}
      </p>

      {/* Options enter in a quick stagger when the sheet opens; snaps in under
          prefers-reduced-motion. */}
      <Stagger stagger={0.06} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {lastUsedTemplate && (
          <StaggerItem>
            <StartOption
              accent
              badge="מומלץ"
              icon={<RotateCcw size={20} aria-hidden="true" />}
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
                <Sparkles size={20} aria-hidden="true" />
              ) : (
                <LayoutList size={20} aria-hidden="true" />
              )
            }
            title="בחרו תבנית מוכנה"
            subtitle="תרגילים מוכנים מראש — פשוט להתחיל"
            onClick={onPickTemplate}
          />
        </StaggerItem>
        <StaggerItem>
          <StartOption
            icon={<Dumbbell size={20} aria-hidden="true" />}
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
