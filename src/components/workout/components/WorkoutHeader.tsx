// WorkoutHeader - Fresh Steel Compact Appbar
// Brand icon (FS mark), workout name, settings/menu button, timer
// No AI Coach button

import { Check, MoreHorizontal, Settings, Trash2 } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { triggerHaptic } from '../../../utils/haptics';
import { useWorkoutTimer } from '../hooks/useWorkoutTimer';

// ============================================================
// TYPES
// ============================================================

interface WorkoutHeaderProps {
  startTimestamp: number;
  totalPausedTime: number;
  isPaused: boolean;
  currentExerciseName: string;
  onFinish: () => void;
  onDiscard: () => void;
  onOpenSettings: () => void;
  onOpenTutorial: () => void;
  onOpenAICoach?: () => void;
}

// ============================================================
// MONO TIMER (isolated, no parent re-renders)
// ============================================================

const MonoTimer = memo<{
  startTimestamp: number;
  totalPausedTime: number;
  isPaused: boolean;
}>(({ startTimestamp, totalPausedTime, isPaused }) => {
  const { formatted } = useWorkoutTimer({ startTimestamp, totalPausedTime, isPaused });

  return (
    <div className="flex items-center gap-1.5">
      <span className="breathing-dot" aria-hidden="true" />
      <span
        className="tabular-nums kinetic-number"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: 'var(--fs-accent)',
        }}
      >
        {formatted}
      </span>
    </div>
  );
});

MonoTimer.displayName = 'MonoTimer';

// ============================================================
// OVERFLOW MENU (no AI Coach)
// ============================================================

const OverflowMenu = memo<{
  onOpenSettings: () => void;
  onOpenTutorial: () => void;
}>(({ onOpenSettings, onOpenTutorial }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  const item = (icon: React.ReactNode, label: string, handler: () => void) => (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handler();
        setOpen(false);
      }}
      className="w-full flex items-center gap-3 px-4 py-3 active:bg-[var(--fs-surface-2)] transition-colors"
      style={{
        background: 'var(--fs-surface)',
        color: 'var(--fs-ink)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        letterSpacing: '0.06em',
        borderBottom: '1px solid var(--fs-surface-2)',
        textTransform: 'uppercase',
      }}
    >
      <span style={{ color: 'var(--fs-accent)' }}>{icon}</span>
      {label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-label="עוד"
        style={{
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '12px 8px 12px 8px',
          background: 'var(--fs-surface-2)',
          border: '1px solid var(--fs-steel)',
          color: 'var(--fs-ink)',
          cursor: 'pointer',
        }}
      >
        <MoreHorizontal size={16} strokeWidth={2.25} />
      </button>
      {open && (
        <div
          className="absolute z-50"
          style={{
            top: 'calc(100% + 6px)',
            insetInlineEnd: 0,
            minWidth: 160,
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-steel)',
            borderRadius: '14px 10px 14px 10px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
            overflow: 'hidden',
          }}
        >
          {item(
            <svg
              width={14}
              height={14}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>,
            'Tutorial',
            onOpenTutorial
          )}
          {item(<Settings size={14} strokeWidth={2} />, 'הגדרות', onOpenSettings)}
        </div>
      )}
    </div>
  );
});

OverflowMenu.displayName = 'OverflowMenu';

// ============================================================
// MAIN HEADER
// ============================================================

const WorkoutHeader = memo<WorkoutHeaderProps>(
  ({
    startTimestamp,
    totalPausedTime,
    isPaused,
    currentExerciseName,
    onFinish,
    onDiscard,
    onOpenSettings,
    onOpenTutorial,
  }) => {
    const handleFinish = useCallback(() => {
      triggerHaptic('success');
      onFinish();
    }, [onFinish]);

    const handleDiscard = useCallback(() => {
      triggerHaptic('light');
      onDiscard();
    }, [onDiscard]);

    return (
      <header
        className="flex items-center justify-between w-full gap-2 glass-surface-dark scrim-noise"
        style={{
          background: 'var(--fs-surface)',
          padding: '8px 18px 10px',
          borderBottom: '1px solid var(--fs-surface-2)',
        }}
      >
        {/* Left: Brand icon + workout name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {/* FS brand mark */}
          <div
            className="fs-brand-icon"
            style={{
              width: 42,
              height: 42,
              borderRadius: '50%',
              border: '7px solid var(--fs-steel)',
              background: `
                radial-gradient(circle, var(--fs-accent) 0 24%, transparent 25%),
                var(--fs-primary)
              `,
              display: 'grid',
              placeItems: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: 10,
              fontWeight: 800,
              color: '#FFFFFF',
              flexShrink: 0,
            }}
          >
            FS
          </div>

          {/* Workout name */}
          <div style={{ minWidth: 0 }}>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 14,
                color: 'var(--fs-ink)',
                lineHeight: 1.2,
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {currentExerciseName}
            </span>
            <MonoTimer
              startTimestamp={startTimestamp}
              totalPausedTime={totalPausedTime}
              isPaused={isPaused}
            />
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleDiscard();
            }}
            aria-label="מחק אימון"
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '12px 8px 12px 8px',
              background: 'transparent',
              border: '1px solid var(--fs-steel)',
              color: 'var(--fs-muted)',
              cursor: 'pointer',
            }}
          >
            <Trash2 size={14} strokeWidth={2.25} />
          </button>

          <OverflowMenu onOpenSettings={onOpenSettings} onOpenTutorial={onOpenTutorial} />

          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleFinish();
            }}
            aria-label="סיים אימון"
            style={{
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '12px 8px 12px 8px',
              background: 'var(--fs-accent)',
              border: 'none',
              color: '#FFFFFF',
              cursor: 'pointer',
            }}
          >
            <Check size={18} strokeWidth={2.5} />
          </button>
        </div>
      </header>
    );
  }
);

WorkoutHeader.displayName = 'WorkoutHeader';

export default WorkoutHeader;
