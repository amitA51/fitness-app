// WorkoutHeader - Sport Annual Editorial Strip
// Thin bone strip with chip actions, mono timer, navy pulsing dot

import { BookOpen, Check, MoreHorizontal, Settings, Sparkles, Trash2 } from 'lucide-react';
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
  onOpenAICoach: () => void;
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
  const dotColor = isPaused ? 'var(--stone)' : 'var(--mustard)';

  return (
    <div className="flex items-center gap-2.5">
      <span
        className="inline-block"
        style={{
          width: 8,
          height: 8,
          background: dotColor,
          borderRadius: 0,
          animation: isPaused ? 'none' : 'pulse 1.4s ease-in-out infinite',
        }}
        aria-hidden
      />
      <span
        className="tabular-nums"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          fontWeight: 500,
          letterSpacing: '0.12em',
          color: 'var(--navy)',
        }}
      >
        {formatted}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.22em',
          color: isPaused ? 'var(--stone)' : 'var(--mustard)',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        {isPaused ? 'PAUSED' : 'LIVE'}
      </span>
    </div>
  );
});

MonoTimer.displayName = 'MonoTimer';

// ============================================================
// SHARP CHIP BUTTON
// ============================================================

interface ChipBtnProps {
  icon: React.ReactNode;
  onClick: () => void;
  label: string;
  variant?: 'outline' | 'inverted';
}

const ChipBtn = memo<ChipBtnProps>(({ icon, onClick, label, variant = 'outline' }) => {
  const inverted = variant === 'inverted';
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className="flex items-center justify-center active:scale-95 transition-transform"
      style={{
        width: 40,
        height: 40,
        background: inverted ? 'var(--navy)' : 'var(--bone)',
        border: '2px solid var(--navy)',
        color: inverted ? 'var(--mustard)' : 'var(--navy)',
        borderRadius: 0,
      }}
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  );
});

ChipBtn.displayName = 'ChipBtn';

// ============================================================
// OVERFLOW MENU
// ============================================================

const OverflowMenu = memo<{
  onOpenSettings: () => void;
  onOpenTutorial: () => void;
  onOpenAICoach: () => void;
}>(({ onOpenSettings, onOpenTutorial, onOpenAICoach }) => {
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
      className="w-full flex items-center gap-3 px-4 py-3 active:bg-[var(--bone-deep)] transition-colors"
      style={{
        background: 'var(--bone)',
        color: 'var(--navy)',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        letterSpacing: '0.08em',
        borderBottom: '1px solid var(--bone-deep)',
        textTransform: 'uppercase',
      }}
    >
      <span style={{ color: 'var(--mustard)' }}>{icon}</span>
      {label}
    </button>
  );

  return (
    <div ref={ref} className="relative">
      <ChipBtn
        icon={<MoreHorizontal size={18} strokeWidth={2.25} />}
        onClick={() => setOpen((o) => !o)}
        label="עוד"
      />
      {open && (
        <div
          className="absolute z-50"
          style={{
            top: 'calc(100% + 6px)',
            insetInlineEnd: 0,
            minWidth: 180,
            background: 'var(--bone)',
            border: '2px solid var(--navy)',
            borderRadius: 0,
            boxShadow: '4px 4px 0 var(--navy)',
          }}
        >
          {item(<Sparkles size={14} />, 'AI COACH', onOpenAICoach)}
          {item(<BookOpen size={14} />, 'TUTORIAL', onOpenTutorial)}
          {item(<Settings size={14} />, 'הגדרות', onOpenSettings)}
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
    onFinish,
    onDiscard,
    onOpenSettings,
    onOpenTutorial,
    onOpenAICoach,
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
        className="flex items-center justify-between w-full gap-3"
        style={{
          background: 'var(--bone)',
          padding: '10px 14px',
          borderBottom: '1px solid var(--bone-deep)',
        }}
      >
        {/* Left: discard */}
        <ChipBtn
          icon={<Trash2 size={16} strokeWidth={2.25} />}
          onClick={handleDiscard}
          label="מחק אימון"
        />

        {/* Middle: timer */}
        <MonoTimer
          startTimestamp={startTimestamp}
          totalPausedTime={totalPausedTime}
          isPaused={isPaused}
        />

        {/* Right: overflow + finish */}
        <div className="flex items-center gap-2">
          <OverflowMenu
            onOpenSettings={onOpenSettings}
            onOpenTutorial={onOpenTutorial}
            onOpenAICoach={onOpenAICoach}
          />
          <ChipBtn
            icon={<Check size={20} strokeWidth={2.5} />}
            onClick={handleFinish}
            label="סיים אימון"
            variant="inverted"
          />
        </div>
      </header>
    );
  }
);

WorkoutHeader.displayName = 'WorkoutHeader';

export default WorkoutHeader;
