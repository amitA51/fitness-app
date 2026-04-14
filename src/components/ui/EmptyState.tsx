// Optimized EmptyState - Static SVGs by default for better performance
import React from 'react';
import { FONT_SIZES } from '../../constants/designTokens';
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
  illustration?: 'tasks' | 'habits' | 'feed' | 'search' | 'generic' | 'calendar' | 'notes' | 'workout' | 'success' | 'error';
  size?: 'small' | 'medium' | 'large';
  animated?: boolean;
}

// Static SVG Illustrations - No Framer Motion for better performance
const TasksIllustration: React.FC = () => (
  <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="tasksGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--cyan)" />
        <stop offset="100%" stopColor="var(--purple)" />
      </linearGradient>
    </defs>
    <rect x="40" y="30" width="120" height="140" rx="16" fill="var(--gray-100)" stroke="url(#tasksGradient)" strokeWidth="2" />
    <rect x="55" y="55" width="90" height="12" rx="6" fill="var(--gray-200)" />
    <rect x="55" y="80" width="70" height="12" rx="6" fill="var(--gray-150)" />
    <rect x="55" y="105" width="80" height="12" rx="6" fill="var(--gray-150)" />
    <circle cx="100" cy="145" r="20" fill="url(#tasksGradient)" />
    <path d="M92 145l6 6 12-12" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const HabitsIllustration: React.FC = () => (
  <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="habitsGradient" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="var(--green)" />
        <stop offset="100%" stopColor="var(--cyan)" />
      </linearGradient>
    </defs>
    {[0, 1, 2, 3, 4].map((i) => (
      <rect
        key={i}
        x={35 + i * 28}
        y={160 - (i === 2 ? 100 : i === 1 || i === 3 ? 70 : i === 0 || i === 4 ? 40 : 30)}
        width="20"
        height={i === 2 ? 100 : i === 1 || i === 3 ? 70 : i === 0 || i === 4 ? 40 : 30}
        rx="6"
        fill={i === 2 ? 'url(#habitsGradient)' : 'var(--gray-200)'}
      />
    ))}
    <circle cx="100" cy="45" r="25" fill="url(#habitsGradient)" />
    <path d="M100 30v15M100 55l10-10M100 55l-10-10" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
  </svg>
);

const FeedIllustration: React.FC = () => (
  <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="feedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--amber)" />
        <stop offset="100%" stopColor="var(--red)" />
      </linearGradient>
    </defs>
    <rect x="25" y="25" width="70" height="70" rx="16" fill="var(--gray-100)" stroke="url(#feedGradient)" strokeWidth="2" />
    <rect x="105" y="25" width="70" height="32" rx="10" fill="var(--gray-150)" />
    <rect x="105" y="63" width="50" height="32" rx="10" fill="var(--gray-150)" />
    <rect x="25" y="105" width="150" height="70" rx="16" fill="var(--gray-100)" stroke="var(--gray-200)" strokeWidth="1" />
    <circle cx="60" cy="60" r="18" fill="url(#feedGradient)" />
    <path d="M55 60l3 3 7-7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const SearchIllustration: React.FC = () => (
  <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="searchGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--purple)" />
        <stop offset="100%" stopColor="var(--pink)" />
      </linearGradient>
    </defs>
    <circle cx="85" cy="85" r="45" fill="var(--gray-100)" stroke="url(#searchGradient)" strokeWidth="3" />
    <circle cx="85" cy="85" r="25" fill="var(--purple)" opacity="0.2" />
    <line x1="120" y1="120" x2="160" y2="160" stroke="url(#searchGradient)" strokeWidth="8" strokeLinecap="round" />
    <circle cx="160" cy="160" r="12" fill="url(#searchGradient)" />
  </svg>
);

const CalendarIllustration: React.FC = () => (
  <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="calendarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--pink)" />
        <stop offset="100%" stopColor="var(--purple)" />
      </linearGradient>
    </defs>
    <rect x="30" y="40" width="140" height="130" rx="16" fill="var(--gray-100)" stroke="url(#calendarGradient)" strokeWidth="2" />
    <rect x="30" y="40" width="140" height="35" rx="16" fill="url(#calendarGradient)" />
    <line x1="60" y1="25" x2="60" y2="55" stroke="url(#calendarGradient)" strokeWidth="6" strokeLinecap="round" />
    <line x1="140" y1="25" x2="140" y2="55" stroke="url(#calendarGradient)" strokeWidth="6" strokeLinecap="round" />
    {[0, 1, 2].map((row) =>
      [0, 1, 2, 3].map((col) => (
        <rect
          key={`${row}-${col}`}
          x={50 + col * 30}
          y={95 + row * 25}
          width="20"
          height="18"
          rx="4"
          fill={row === 1 && col === 2 ? 'url(#calendarGradient)' : 'var(--gray-150)'}
        />
      ))
    )}
  </svg>
);

const NotesIllustration: React.FC = () => (
  <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="notesGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--cyan)" />
        <stop offset="100%" stopColor="var(--blue)" />
      </linearGradient>
    </defs>
    <rect x="40" y="25" width="120" height="150" rx="12" fill="var(--gray-100)" stroke="url(#notesGradient)" strokeWidth="2" />
    {[0, 1, 2, 3, 4].map((i) => (
      <rect
        key={i}
        x="55"
        y={50 + i * 25}
        width={i === 0 ? 90 : i === 1 ? 70 : i === 2 ? 80 : i === 3 ? 50 : 60}
        height="10"
        rx="5"
        fill={i === 0 ? 'url(#notesGradient)' : 'var(--gray-150)'}
      />
    ))}
    <circle cx="145" cy="160" r="18" fill="url(#notesGradient)" />
    <path d="M140 160l-10-10M150 160l10-10" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
  </svg>
);

const WorkoutIllustration: React.FC = () => (
  <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="workoutGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--red)" />
        <stop offset="100%" stopColor="var(--amber)" />
      </linearGradient>
    </defs>
    <rect x="25" y="90" width="30" height="20" rx="4" fill="url(#workoutGradient)" />
    <rect x="145" y="90" width="30" height="20" rx="4" fill="url(#workoutGradient)" />
    <rect x="55" y="80" width="90" height="40" rx="6" fill="var(--gray-200)" stroke="url(#workoutGradient)" strokeWidth="2" />
    <rect x="35" y="75" width="20" height="50" rx="4" fill="var(--gray-300)" />
    <rect x="145" y="75" width="20" height="50" rx="4" fill="var(--gray-300)" />
    <circle cx="100" cy="155" r="25" fill="url(#workoutGradient)" />
    <path d="M90 155h20M100 145v20" stroke="white" strokeWidth="3" strokeLinecap="round" fill="none" />
  </svg>
);

const SuccessIllustration: React.FC = () => (
  <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="successGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--green)" />
        <stop offset="100%" stopColor="var(--light-green)" />
      </linearGradient>
    </defs>
    <circle cx="100" cy="100" r="60" fill="var(--green)" opacity="0.1" stroke="url(#successGradient)" strokeWidth="3" />
    <circle cx="100" cy="100" r="40" fill="url(#successGradient)" />
    <path d="M80 100l15 15 30-30" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    {[0, 1, 2, 3, 4, 5].map((i) => (
      <circle
        key={i}
        cx={100 + Math.cos((i * 60 * Math.PI) / 180) * 85}
        cy={100 + Math.sin((i * 60 * Math.PI) / 180) * 85}
        r="6"
        fill="url(#successGradient)"
        opacity="0.6"
      />
    ))}
  </svg>
);

const ErrorIllustration: React.FC = () => (
  <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="errorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--red)" />
        <stop offset="100%" stopColor="var(--light-red)" />
      </linearGradient>
    </defs>
    <circle cx="100" cy="100" r="60" fill="var(--red)" opacity="0.1" stroke="url(#errorGradient)" strokeWidth="3" />
    <circle cx="100" cy="100" r="40" fill="url(#errorGradient)" />
    <path d="M85 85l30 30M115 85l-30 30" stroke="white" strokeWidth="6" strokeLinecap="round" fill="none" />
  </svg>
);

const GenericIllustration: React.FC = () => (
  <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
    <defs>
      <linearGradient id="genericGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="var(--purple)" />
        <stop offset="100%" stopColor="var(--cyan)" />
      </linearGradient>
    </defs>
    <rect x="30" y="50" width="140" height="100" rx="16" fill="var(--gray-100)" stroke="url(#genericGradient)" strokeWidth="2" />
    <line x1="30" y1="80" x2="170" y2="80" stroke="var(--gray-200)" strokeWidth="1" />
    <rect x="45" y="95" width="60" height="8" rx="4" fill="var(--gray-200)" />
    <rect x="45" y="115" width="40" height="8" rx="4" fill="var(--gray-150)" />
    <circle cx="140" cy="110" r="22" fill="url(#genericGradient)" />
    <path d="M135 110h10M140 105v10" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
  </svg>
);

const ILLUSTRATIONS: Record<EmptyStateProps['illustration'] & string, React.FC> = {
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
          background: 'radial-gradient(ellipse 60% 50% at center 40%, var(--dynamic-accent-color, rgba(0,122,255,0.06)) 0%, transparent 100%)',
        }}
      />

      <div
        className={`${SIZE_CLASSES[size]} mb-8 ${enableAnimations ? 'animate-emptyStateIllustration' : ''}`}
      >
        {icon || <IllustrationComponent />}
      </div>

      <h3
        className="font-bold mb-2.5"
        style={{ color: 'var(--text-primary)', fontSize: FONT_SIZES.xl, letterSpacing: '-0.01em' }}
      >
        {title}
      </h3>

      {description && (
        <p
          className="max-w-xs mb-8 leading-relaxed"
          style={{ color: 'var(--text-secondary)', fontSize: FONT_SIZES.sm }}
        >
          {description}
        </p>
      )}

      <div className="flex flex-col sm:flex-row items-center gap-3">
        {action && (
          <button
            onClick={action.onClick}
            className="
              flex items-center gap-2.5
              px-7 py-3.5
              rounded-2xl
              text-white font-semibold text-[15px]
              transition-all duration-200
              hover:scale-[1.03] hover:-translate-y-0.5
              active:scale-[0.97]
            "
            style={{
              background: 'var(--accent-gradient, var(--dynamic-accent-start, #007AFF))',
              boxShadow: '0 6px 20px var(--dynamic-accent-glow, rgba(0, 122, 255, 0.30))',
            }}
          >
            {action.icon}
            {action.label}
          </button>
        )}

        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="
              font-medium text-[14px]
              px-5 py-2.5
              rounded-xl
              transition-all duration-200
              active:scale-[0.97]
              empty-state-secondary-btn
            "
            style={{
              color: 'var(--text-secondary)',
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
      `}</style>
    </div>
  );
};

export default EmptyState;
