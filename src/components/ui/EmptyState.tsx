// Optimized EmptyState - Static SVGs by default for better performance
import type React from 'react';
import { useId } from 'react';
import { ANIMATION_CONFIG } from '../../components/animations/config';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  illustration?:
    | 'tasks'
    | 'habits'
    | 'feed'
    | 'search'
    | 'generic'
    | 'calendar'
    | 'notes'
    | 'workout'
    | 'success'
    | 'error';
  size?: 'small' | 'medium' | 'large';
  animated?: boolean;
}

// Fresh Steel color values for SVGs
const FS = {
  accent: 'var(--fs-accent)',
  primary: 'var(--fs-primary)',
  signal: 'var(--fs-signal)',
  warn: 'var(--fs-warn)',
  accent2: 'var(--fs-accent-2)',
  bg: 'var(--fs-bg)',
  surface2: 'var(--fs-surface-2)',
  plate: 'var(--fs-plate)',
  steel: 'var(--fs-steel)',
  surface: 'var(--fs-surface)',
  muted: 'var(--fs-muted)',
};

// Static SVG Illustrations - No Framer Motion for better performance
const TasksIllustration: React.FC<{ idPrefix: string }> = ({ idPrefix }) => (
  <svg viewBox="0 0 200 200" fill="none" className="w-full h-full" aria-hidden="true">
    <defs>
      <linearGradient id={`${idPrefix}-tasksGradient`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={FS.accent} />
        <stop offset="100%" stopColor={FS.primary} />
      </linearGradient>
    </defs>
    <rect
      x="40"
      y="30"
      width="120"
      height="140"
      rx="0"
      fill={FS.bg}
      stroke={`url(#${idPrefix}-tasksGradient)`}
      strokeWidth="2"
    />
    <rect x="55" y="55" width="90" height="12" rx="0" fill={FS.surface2} />
    <rect x="55" y="80" width="70" height="12" rx="0" fill={FS.plate} />
    <rect x="55" y="105" width="80" height="12" rx="0" fill={FS.plate} />
    <circle cx="100" cy="145" r="20" fill={`url(#${idPrefix}-tasksGradient)`} />
    <path
      d="M92 145l6 6 12-12"
      stroke="var(--color-ink-on-dark)"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const HabitsIllustration: React.FC<{ idPrefix: string }> = ({ idPrefix }) => (
  <svg viewBox="0 0 200 200" fill="none" className="w-full h-full" aria-hidden="true">
    <defs>
      <linearGradient id={`${idPrefix}-habitsGradient`} x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor={FS.accent} />
        <stop offset="100%" stopColor={FS.accent} />
      </linearGradient>
    </defs>
    {[0, 1, 2, 3, 4].map((i) => (
      <rect
        key={i}
        x={35 + i * 28}
        y={160 - (i === 2 ? 100 : i === 1 || i === 3 ? 70 : i === 0 || i === 4 ? 40 : 30)}
        width="20"
        height={i === 2 ? 100 : i === 1 || i === 3 ? 70 : i === 0 || i === 4 ? 40 : 30}
        rx="0"
        fill={i === 2 ? `url(#${idPrefix}-habitsGradient)` : FS.surface2}
      />
    ))}
    <circle cx="100" cy="45" r="25" fill={`url(#${idPrefix}-habitsGradient)`} />
    <path
      d="M100 30v15M100 55l10-10M100 55l-10-10"
      stroke="var(--color-ink-on-accent)"
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

const FeedIllustration: React.FC<{ idPrefix: string }> = ({ idPrefix }) => (
  <svg viewBox="0 0 200 200" fill="none" className="w-full h-full" aria-hidden="true">
    <defs>
      <linearGradient id={`${idPrefix}-feedGradient`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={FS.signal} />
        <stop offset="100%" stopColor={FS.warn} />
      </linearGradient>
    </defs>
    <rect
      x="25"
      y="25"
      width="70"
      height="70"
      rx="0"
      fill={FS.bg}
      stroke={`url(#${idPrefix}-feedGradient)`}
      strokeWidth="2"
    />
    <rect x="105" y="25" width="70" height="32" rx="0" fill={FS.plate} />
    <rect x="105" y="63" width="50" height="32" rx="0" fill={FS.plate} />
    <rect
      x="25"
      y="105"
      width="150"
      height="70"
      rx="0"
      fill={FS.bg}
      stroke={FS.surface2}
      strokeWidth="1"
    />
    <circle cx="60" cy="60" r="18" fill={`url(#${idPrefix}-feedGradient)`} />
    <path
      d="M55 60l3 3 7-7"
      stroke="var(--color-ink-on-accent)"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

const SearchIllustration: React.FC<{ idPrefix: string }> = ({ idPrefix }) => (
  <svg viewBox="0 0 200 200" fill="none" className="w-full h-full" aria-hidden="true">
    <defs>
      <linearGradient id={`${idPrefix}-searchGradient`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={FS.primary} />
        <stop offset="100%" stopColor={FS.accent} />
      </linearGradient>
    </defs>
    <circle
      cx="85"
      cy="85"
      r="45"
      fill={FS.bg}
      stroke={`url(#${idPrefix}-searchGradient)`}
      strokeWidth="3"
    />
    <circle cx="85" cy="85" r="25" fill={FS.primary} opacity="0.15" />
    <line
      x1="120"
      y1="120"
      x2="160"
      y2="160"
      stroke={`url(#${idPrefix}-searchGradient)`}
      strokeWidth="8"
      strokeLinecap="round"
    />
    <circle cx="160" cy="160" r="12" fill={`url(#${idPrefix}-searchGradient)`} />
  </svg>
);

const CalendarIllustration: React.FC<{ idPrefix: string }> = ({ idPrefix }) => (
  <svg viewBox="0 0 200 200" fill="none" className="w-full h-full" aria-hidden="true">
    <defs>
      <linearGradient id={`${idPrefix}-calendarGradient`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={FS.accent} />
        <stop offset="100%" stopColor={FS.primary} />
      </linearGradient>
    </defs>
    <rect
      x="30"
      y="40"
      width="140"
      height="130"
      rx="0"
      fill={FS.bg}
      stroke={`url(#${idPrefix}-calendarGradient)`}
      strokeWidth="2"
    />
    <rect
      x="30"
      y="40"
      width="140"
      height="35"
      rx="0"
      fill={`url(#${idPrefix}-calendarGradient)`}
    />
    <line
      x1="60"
      y1="25"
      x2="60"
      y2="55"
      stroke={`url(#${idPrefix}-calendarGradient)`}
      strokeWidth="6"
      strokeLinecap="round"
    />
    <line
      x1="140"
      y1="25"
      x2="140"
      y2="55"
      stroke={`url(#${idPrefix}-calendarGradient)`}
      strokeWidth="6"
      strokeLinecap="round"
    />
    {[0, 1, 2].map((row) =>
      [0, 1, 2, 3].map((col) => (
        <rect
          key={`${row}-${col}`}
          x={50 + col * 30}
          y={95 + row * 25}
          width="20"
          height="18"
          rx="0"
          fill={row === 1 && col === 2 ? `url(#${idPrefix}-calendarGradient)` : FS.plate}
        />
      ))
    )}
  </svg>
);

const NotesIllustration: React.FC<{ idPrefix: string }> = ({ idPrefix }) => (
  <svg viewBox="0 0 200 200" fill="none" className="w-full h-full" aria-hidden="true">
    <defs>
      <linearGradient id={`${idPrefix}-notesGradient`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={FS.accent} />
        <stop offset="100%" stopColor={FS.accent2} />
      </linearGradient>
    </defs>
    <rect
      x="40"
      y="25"
      width="120"
      height="150"
      rx="0"
      fill={FS.bg}
      stroke={`url(#${idPrefix}-notesGradient)`}
      strokeWidth="2"
    />
    {[0, 1, 2, 3, 4].map((i) => (
      <rect
        key={i}
        x="55"
        y={50 + i * 25}
        width={i === 0 ? 90 : i === 1 ? 70 : i === 2 ? 80 : i === 3 ? 50 : 60}
        height="10"
        rx="0"
        fill={i === 0 ? `url(#${idPrefix}-notesGradient)` : FS.plate}
      />
    ))}
    <circle cx="145" cy="160" r="18" fill={`url(#${idPrefix}-notesGradient)`} />
    <path
      d="M140 160l-10-10M150 160l10-10"
      stroke="var(--color-ink-on-accent)"
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

const WorkoutIllustration: React.FC<{ idPrefix: string }> = ({ idPrefix }) => (
  <svg viewBox="0 0 200 200" fill="none" className="w-full h-full" aria-hidden="true">
    <defs>
      <linearGradient id={`${idPrefix}-workoutGradient`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={FS.warn} />
        <stop offset="100%" stopColor={FS.signal} />
      </linearGradient>
    </defs>
    <rect x="25" y="90" width="30" height="20" rx="0" fill={`url(#${idPrefix}-workoutGradient)`} />
    <rect x="145" y="90" width="30" height="20" rx="0" fill={`url(#${idPrefix}-workoutGradient)`} />
    <rect
      x="55"
      y="80"
      width="90"
      height="40"
      rx="0"
      fill={FS.surface2}
      stroke={`url(#${idPrefix}-workoutGradient)`}
      strokeWidth="2"
    />
    <rect x="35" y="75" width="20" height="50" rx="0" fill={FS.steel} />
    <rect x="145" y="75" width="20" height="50" rx="0" fill={FS.steel} />
    <circle cx="100" cy="155" r="25" fill={`url(#${idPrefix}-workoutGradient)`} />
    <path
      d="M90 155h20M100 145v20"
      stroke="var(--color-ink-on-accent)"
      strokeWidth="3"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

const SuccessIllustration: React.FC<{ idPrefix: string }> = ({ idPrefix }) => (
  <svg viewBox="0 0 200 200" fill="none" className="w-full h-full" aria-hidden="true">
    <defs>
      <linearGradient id={`${idPrefix}-successGradient`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={FS.accent} />
        <stop offset="100%" stopColor={FS.accent} />
      </linearGradient>
    </defs>
    <circle
      cx="100"
      cy="100"
      r="60"
      fill={FS.accent}
      opacity="0.1"
      stroke={`url(#${idPrefix}-successGradient)`}
      strokeWidth="3"
    />
    <circle cx="100" cy="100" r="40" fill={`url(#${idPrefix}-successGradient)`} />
    <path
      d="M80 100l15 15 30-30"
      stroke="var(--color-ink-on-accent)"
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <circle
        key={i}
        cx={100 + Math.cos((i * 60 * Math.PI) / 180) * 85}
        cy={100 + Math.sin((i * 60 * Math.PI) / 180) * 85}
        r="6"
        fill={`url(#${idPrefix}-successGradient)`}
        opacity="0.6"
      />
    ))}
  </svg>
);

const ErrorIllustration: React.FC<{ idPrefix: string }> = ({ idPrefix }) => (
  <svg viewBox="0 0 200 200" fill="none" className="w-full h-full" aria-hidden="true">
    <defs>
      <linearGradient id={`${idPrefix}-errorGradient`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={FS.warn} />
        <stop offset="100%" stopColor={FS.warn} />
      </linearGradient>
    </defs>
    <circle
      cx="100"
      cy="100"
      r="60"
      fill={FS.warn}
      opacity="0.1"
      stroke={`url(#${idPrefix}-errorGradient)`}
      strokeWidth="3"
    />
    <circle cx="100" cy="100" r="40" fill={`url(#${idPrefix}-errorGradient)`} />
    <path
      d="M85 85l30 30M115 85l-30 30"
      stroke="var(--color-ink-on-accent)"
      strokeWidth="6"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

const GenericIllustration: React.FC<{ idPrefix: string }> = ({ idPrefix }) => (
  <svg viewBox="0 0 200 200" fill="none" className="w-full h-full" aria-hidden="true">
    <defs>
      <linearGradient id={`${idPrefix}-genericGradient`} x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor={FS.primary} />
        <stop offset="100%" stopColor={FS.accent} />
      </linearGradient>
    </defs>
    <rect
      x="30"
      y="50"
      width="140"
      height="100"
      rx="0"
      fill={FS.bg}
      stroke={`url(#${idPrefix}-genericGradient)`}
      strokeWidth="2"
    />
    <line x1="30" y1="80" x2="170" y2="80" stroke={FS.surface2} strokeWidth="1" />
    <rect x="45" y="95" width="60" height="8" rx="0" fill={FS.surface2} />
    <rect x="45" y="115" width="40" height="8" rx="0" fill={FS.plate} />
    <circle cx="140" cy="110" r="22" fill={`url(#${idPrefix}-genericGradient)`} />
    <path
      d="M135 110h10M140 105v10"
      stroke="var(--color-ink-on-dark)"
      strokeWidth="2.5"
      strokeLinecap="round"
      fill="none"
    />
  </svg>
);

const ILLUSTRATIONS: Record<
  EmptyStateProps['illustration'] & string,
  React.FC<{ idPrefix: string }>
> = {
  tasks: TasksIllustration,
  habits: HabitsIllustration,
  feed: FeedIllustration,
  search: SearchIllustration,
  calendar: CalendarIllustration,
  notes: NotesIllustration,
  workout: WorkoutIllustration,
  success: SuccessIllustration,
  error: ErrorIllustration,
  generic: GenericIllustration,
};

const SIZE_CLASSES = {
  small: 'w-24 h-24',
  medium: 'w-32 h-32',
  large: 'w-40 h-40',
};

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  secondaryAction,
  illustration = 'generic',
  size = 'medium',
  animated = true,
}) => {
  const IllustrationComponent = ILLUSTRATIONS[illustration];
  const idPrefix = useId();

  // Check if animations should be enabled
  const enableAnimations = animated && ANIMATION_CONFIG.enableAnimations;

  return (
    <div
      className={`
        relative flex flex-col items-center justify-center py-14 px-6 text-center
        ${enableAnimations ? 'animate-emptyStateReveal' : ''}
      `}
    >
      {/* Refined ambient glow */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at center 40%, rgba(var(--fs-accent-rgb), 0.07) 0%, transparent 100%)',
        }}
      />

      <div
        className={`${SIZE_CLASSES[size]} mb-8 ${enableAnimations ? 'animate-emptyStateIllustration' : ''}`}
      >
        {icon || <IllustrationComponent idPrefix={idPrefix} />}
      </div>

      <h3
        className="font-bold mb-2.5 text-lg"
        style={{
          fontFamily: 'var(--font-display)',
          textTransform: 'uppercase',
          color: 'var(--fs-ink)',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </h3>

      {description && (
        <p className="max-w-xs mb-8 leading-relaxed text-sm" style={{ color: 'var(--fs-muted)' }}>
          {description}
        </p>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-3">
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-focus-ring)] focus-visible:ring-offset-2"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 28px',
              borderRadius: 0,
              background: 'var(--fs-primary)',
              color: 'var(--fs-accent)',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '15px',
              textTransform: 'uppercase',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              minHeight: 44,
            }}
          >
            {action.icon}
            {action.label}
          </button>
        )}

        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-focus-ring)] focus-visible:ring-offset-2"
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: '14px',
              padding: '10px 20px',
              borderRadius: 0,
              background: 'transparent',
              color: 'var(--fs-muted)',
              border: '1px solid var(--fs-surface-2)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              minHeight: 44,
            }}
          >
            {secondaryAction.label}
          </button>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes emptyStateReveal {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes emptyStateIllustration {
          from { opacity: 0; transform: scale(0.9) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-emptyStateReveal {
          animation: emptyStateReveal 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .animate-emptyStateIllustration {
          animation: emptyStateIllustration 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.1s forwards;
          opacity: 0;
        }
        @media (prefers-reduced-motion: reduce){
          .animate-emptyStateReveal,.animate-emptyStateIllustration{animation:none;opacity:1}
        }
      `}</style>
    </div>
  );
};

export default EmptyState;
