import type React from 'react';

// ========================================
// Skeleton Primitive Components
// Premium shimmer surface — single source of truth via .premium-shimmer
// ========================================

// Radii match the actual content shapes for seamless loading transitions
const RADIUS_MAP: Record<string, string> = {
  full: '9999px',
  lg: '12px',
  xl: '16px',
  md: '8px',
  sm: '4px',
};

const getRadiusStyle = (radius?: string): string => {
  if (!radius) return '8px';
  return RADIUS_MAP[radius] || radius;
};

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  className?: string;
  /** Whether to apply shimmer animation (default true). When false, renders a static placeholder. */
  shimmer?: boolean;
}

export const SkeletonBox: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '20px',
  borderRadius = '0',
  className = '',
  shimmer = true,
}) => (
  <div
    className={`${shimmer ? 'premium-shimmer' : ''} ${className}`.trim()}
    style={{
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
      borderRadius: getRadiusStyle(borderRadius),
    }}
  />
);

export const SkeletonCircle: React.FC<{ size?: number; className?: string; shimmer?: boolean }> = ({
  size = 40,
  className = '',
  shimmer = true,
}) => (
  <div
    className={`${shimmer ? 'premium-shimmer' : ''} ${className}`.trim()}
    style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
    }}
  />
);

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 3,
  className = '',
}) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders, fixed count, never reordered
      <SkeletonBox key={i} height={16} width={i === lines - 1 ? '80%' : '100%'} />
    ))}
  </div>
);

// ========================================
// Pre-built Skeleton Templates
// ========================================

export const SkeletonCard: React.FC = () => (
  <div
    style={{
      background: 'var(--fs-surface)',
      border: '1px solid var(--fs-surface-2)',
      boxShadow: 'var(--shadow-card)',
      padding: 16,
    }}
  >
    <div className="flex items-start gap-4">
      <SkeletonCircle size={40} />
      <div className="flex-1 space-y-2">
        <SkeletonBox height={24} width="70%" />
        <SkeletonBox height={16} width="40%" />
      </div>
    </div>
    <SkeletonText lines={2} />
    <div className="flex gap-2">
      <SkeletonBox height={24} width={60} borderRadius="full" />
      <SkeletonBox height={24} width={80} borderRadius="full" />
    </div>
  </div>
);

export const SkeletonList: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="space-y-4">
    {Array.from({ length: count }).map((_, i) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders, fixed count, never reordered
      <SkeletonCard key={i} />
    ))}
  </div>
);

export const SkeletonGrid: React.FC<{ count?: number; columns?: number }> = ({
  count = 6,
  columns = 3,
}) => (
  <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
    {Array.from({ length: count }).map((_, i) => (
      <div
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders, fixed count, never reordered
        key={i}
        style={{
          background: 'var(--fs-surface)',
          border: '1px solid var(--fs-surface-2)',
          boxShadow: 'var(--shadow-card)',
          padding: 16,
        }}
      >
        <SkeletonCircle size={48} className="mx-auto" />
        <SkeletonBox height={20} />
        <SkeletonBox height={16} width="60%" className="mx-auto" />
      </div>
    ))}
  </div>
);

// ========================================
// HomeScreen Specific Skeletons
// ========================================

/** Skeleton for a single task item */
export const SkeletonTaskItem: React.FC = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      background: 'var(--fs-surface)',
      border: '1px solid var(--fs-surface-2)',
    }}
  >
    <SkeletonCircle size={24} />
    <div className="flex-1 space-y-2">
      <SkeletonBox height={18} width="60%" />
      <SkeletonBox height={14} width="35%" />
    </div>
    <SkeletonBox height={24} width={24} borderRadius="12px" />
  </div>
);

/** Skeleton for a habit item */
export const SkeletonHabitItem: React.FC = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      background: 'var(--fs-surface)',
      border: '1px solid var(--fs-surface-2)',
    }}
  >
    <SkeletonCircle size={40} />
    <div className="flex-1 space-y-2">
      <SkeletonBox height={18} width="50%" />
      <div className="flex gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders, fixed count, never reordered
          <SkeletonBox key={i} height={20} width={20} borderRadius="sm" />
        ))}
      </div>
    </div>
  </div>
);

/** Skeleton for the quote widget */
export const SkeletonQuoteWidget: React.FC = () => (
  <div
    style={{
      background: 'var(--fs-surface)',
      border: '1px solid var(--fs-surface-2)',
      boxShadow: 'var(--shadow-card)',
      padding: 24,
    }}
  >
    <div className="flex items-center gap-2">
      <SkeletonCircle size={32} />
      <SkeletonBox height={16} width={100} />
    </div>
    <SkeletonBox height={80} />
    <div className="flex justify-end">
      <SkeletonBox height={14} width={120} />
    </div>
  </div>
);

/** Skeleton for the gratitude tracker */
export const SkeletonGratitudeWidget: React.FC = () => (
  <div
    style={{
      background: 'var(--fs-surface)',
      border: '1px solid var(--fs-surface-2)',
      boxShadow: 'var(--shadow-card)',
      padding: 24,
    }}
  >
    <SkeletonBox height={20} width={150} />
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders, fixed count, never reordered
        <div key={i} className="flex items-center gap-3">
          <SkeletonCircle size={24} />
          <SkeletonBox height={40} width="100%" borderRadius="lg" />
        </div>
      ))}
    </div>
  </div>
);

/** Full HomeScreen skeleton for initial load */
export const HomeScreenSkeleton: React.FC = () => (
  <div className="screen-shell space-y-8 pb-32 animate-pulse">
    {/* Header skeleton */}
    <div className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SkeletonCircle size={60} />
          <div className="space-y-2">
            <SkeletonBox height={32} width={200} />
            <SkeletonBox height={16} width={150} />
          </div>
        </div>
        <div className="flex gap-2">
          <SkeletonBox height={44} width={44} borderRadius="lg" />
          <SkeletonBox height={44} width={44} borderRadius="lg" />
          <SkeletonBox height={44} width={44} borderRadius="lg" />
        </div>
      </div>
      {/* Stats badges */}
      <div className="flex gap-2 mt-4">
        <SkeletonBox height={28} width={100} borderRadius="full" />
        <SkeletonBox height={28} width={100} borderRadius="full" />
      </div>
    </div>

    {/* Tasks section skeleton */}
    <div className="px-4">
      <div
        style={{
          background: 'var(--fs-surface)',
          border: '1px solid var(--fs-surface-2)',
          boxShadow: 'var(--shadow-card)',
          padding: 24,
        }}
      >
        <SkeletonBox height={24} width={120} />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders, fixed count, never reordered
            <SkeletonTaskItem key={i} />
          ))}
        </div>
      </div>
    </div>

    {/* Habits section skeleton */}
    <div className="px-4">
      <div
        style={{
          background: 'var(--fs-surface)',
          border: '1px solid var(--fs-surface-2)',
          boxShadow: 'var(--shadow-card)',
          padding: 24,
        }}
      >
        <SkeletonBox height={24} width={100} />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders, fixed count, never reordered
            <SkeletonHabitItem key={i} />
          ))}
        </div>
      </div>
    </div>

    {/* Quote widget skeleton */}
    <div className="px-4">
      <SkeletonQuoteWidget />
    </div>
  </div>
);

// ========================================
// FeedScreen Skeleton
// ========================================

/** Skeleton for a feed card item */
export const SkeletonFeedCard: React.FC = () => (
  <div
    style={{
      background: 'var(--fs-surface)',
      border: '1px solid var(--fs-surface-2)',
      boxShadow: 'var(--shadow-card)',
      padding: 16,
    }}
  >
    <div className="flex items-start gap-3">
      <SkeletonBox height={80} width={80} borderRadius="lg" />
      <div className="flex-1 space-y-2">
        <SkeletonBox height={20} width="90%" />
        <SkeletonBox height={16} width="60%" />
        <div className="flex gap-2 mt-2">
          <SkeletonBox height={20} width={60} borderRadius="full" />
          <SkeletonBox height={20} width={80} borderRadius="full" />
        </div>
      </div>
    </div>
    <SkeletonText lines={2} />
  </div>
);

/** Full FeedScreen skeleton for initial load */
export const FeedScreenSkeleton: React.FC = () => (
  <div className="screen-shell space-y-4 pb-32 animate-pulse">
    {/* Header skeleton */}
    <div className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <SkeletonBox height={32} width={120} />
        <div className="flex gap-2">
          <SkeletonBox height={40} width={40} borderRadius="lg" />
          <SkeletonBox height={40} width={40} borderRadius="lg" />
        </div>
      </div>
      {/* View mode tabs */}
      <div className="flex gap-2">
        <SkeletonBox height={36} width={80} borderRadius="full" />
        <SkeletonBox height={36} width={80} borderRadius="full" />
        <SkeletonBox height={36} width={80} borderRadius="full" />
      </div>
    </div>

    {/* Feed cards skeleton */}
    <div className="px-4 space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders, fixed count, never reordered
        <SkeletonFeedCard key={i} />
      ))}
    </div>
  </div>
);

// ========================================
// CalendarScreen Skeleton
// ========================================

/** Calendar grid skeleton */
export const SkeletonCalendarGrid: React.FC = () => (
  <div className="space-y-2">
    {/* Day names header */}
    <div className="grid grid-cols-7 gap-1">
      {Array.from({ length: 7 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders, fixed count, never reordered
        <SkeletonBox key={i} height={24} className="mx-auto" width="80%" />
      ))}
    </div>
    {/* Calendar days */}
    {Array.from({ length: 5 }).map((_, weekIndex) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders, fixed count, never reordered
      <div key={weekIndex} className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, dayIndex) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders, fixed count, never reordered
            key={dayIndex}
            className="premium-shimmer aspect-square p-1"
            style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-surface-2)' }}
          >
            <SkeletonBox height={16} width={20} className="mb-1" />
            {(weekIndex + dayIndex) % 3 === 0 && (
              <SkeletonBox height={8} width="80%" borderRadius="sm" />
            )}
          </div>
        ))}
      </div>
    ))}
  </div>
);

/** Full CalendarScreen skeleton for initial load */
export const CalendarScreenSkeleton: React.FC = () => (
  <div className="screen-shell space-y-4 pb-32 animate-pulse">
    {/* Header skeleton */}
    <div className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <SkeletonBox height={32} width={150} />
        <div className="flex gap-2">
          <SkeletonBox height={40} width={40} borderRadius="lg" />
          <SkeletonBox height={40} width={40} borderRadius="lg" />
        </div>
      </div>
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <SkeletonBox height={36} width={36} borderRadius="lg" />
        <SkeletonBox height={28} width={120} />
        <SkeletonBox height={36} width={36} borderRadius="lg" />
      </div>
    </div>

    {/* Calendar grid skeleton */}
    <div className="px-4">
      <div
        style={{
          background: 'var(--fs-surface)',
          border: '1px solid var(--fs-surface-2)',
          boxShadow: 'var(--shadow-card)',
          padding: 16,
        }}
      >
        <SkeletonCalendarGrid />
      </div>
    </div>

    {/* Events list skeleton */}
    <div className="px-4 space-y-3">
      <SkeletonBox height={24} width={100} />
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders, fixed count, never reordered
          key={i}
          className="flex items-center gap-3 p-3"
          style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-surface-2)' }}
        >
          <SkeletonBox height={40} width={4} borderRadius="full" />
          <div className="flex-1 space-y-2">
            <SkeletonBox height={18} width="70%" />
            <SkeletonBox height={14} width="40%" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ========================================
// SettingsScreen Skeleton
// ========================================

/** Settings section skeleton */
export const SkeletonSettingsSection: React.FC<{ itemCount?: number }> = ({ itemCount = 3 }) => (
  <div
    style={{
      background: 'var(--fs-surface)',
      border: '1px solid var(--fs-surface-2)',
      boxShadow: 'var(--shadow-card)',
      padding: 16,
    }}
  >
    <SkeletonBox height={20} width={100} className="mb-3" />
    {Array.from({ length: itemCount }).map((_, i) => (
      <div
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders, fixed count, never reordered
        key={i}
        className="flex items-center justify-between py-3 last:border-0"
        style={{ borderBottom: i < itemCount - 1 ? '1px solid var(--fs-surface-2)' : 'none' }}
      >
        <div className="flex items-center gap-3">
          <SkeletonCircle size={24} />
          <SkeletonBox height={18} width={120} />
        </div>
        <SkeletonBox height={24} width={48} borderRadius="full" />
      </div>
    ))}
  </div>
);

/** Full SettingsScreen skeleton for initial load */
export const SettingsScreenSkeleton: React.FC = () => (
  <div className="screen-shell space-y-6 pb-32 animate-pulse">
    {/* Header skeleton */}
    <div className="px-4 pt-6">
      <SkeletonBox height={32} width={100} />
    </div>

    {/* User profile section */}
    <div className="px-4">
      <div
        style={{
          background: 'var(--fs-surface)',
          border: '1px solid var(--fs-surface-2)',
          boxShadow: 'var(--shadow-card)',
          padding: 16,
        }}
      >
        <div className="flex items-center gap-4">
          <SkeletonCircle size={64} />
          <div className="flex-1 space-y-2">
            <SkeletonBox height={24} width={150} />
            <SkeletonBox height={16} width={200} />
          </div>
        </div>
      </div>
    </div>

    {/* Settings sections */}
    <div className="px-4 space-y-4">
      <SkeletonSettingsSection itemCount={4} />
      <SkeletonSettingsSection itemCount={3} />
      <SkeletonSettingsSection itemCount={5} />
    </div>
  </div>
);

// ========================================
// AssistantScreen Skeleton
// ========================================

/** Chat message skeleton */
export const SkeletonChatMessage: React.FC<{ isUser?: boolean }> = ({ isUser = false }) => (
  <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
    <SkeletonCircle size={36} />
    <div className={`flex-1 max-w-[80%] space-y-2 ${isUser ? 'items-end' : ''}`}>
      <div
        className="p-4 space-y-2"
        style={{
          background: isUser ? 'var(--fs-surface-2)' : 'var(--fs-surface)',
          border: '1px solid var(--fs-surface-2)',
        }}
      >
        <SkeletonBox height={16} width="100%" />
        <SkeletonBox height={16} width="85%" />
        {!isUser && <SkeletonBox height={16} width="60%" />}
      </div>
    </div>
  </div>
);

/** Full AssistantScreen skeleton for initial load */
export const AssistantScreenSkeleton: React.FC = () => (
  <div className="screen-shell flex flex-col h-[calc(100vh-6rem)] animate-pulse">
    {/* Header skeleton */}
    <div className="px-4 pt-6 pb-4 flex items-center gap-3">
      <SkeletonCircle size={48} />
      <div className="space-y-2">
        <SkeletonBox height={24} width={120} />
        <SkeletonBox height={14} width={80} />
      </div>
    </div>

    {/* Chat messages skeleton */}
    <div className="flex-1 px-4 space-y-4 overflow-hidden">
      <SkeletonChatMessage isUser={false} />
      <SkeletonChatMessage isUser={true} />
      <SkeletonChatMessage isUser={false} />
    </div>

    {/* Input area skeleton */}
    <div className="px-4 py-4" style={{ borderTop: '1px solid var(--fs-surface-2)' }}>
      <div className="flex items-center gap-3">
        <SkeletonBox height={48} width="100%" borderRadius="full" />
        <SkeletonCircle size={48} />
      </div>
    </div>
  </div>
);

// ========================================
// LibraryScreen Skeleton
// ========================================

/** Library item skeleton */
export const SkeletonLibraryItem: React.FC = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      background: 'var(--fs-surface)',
      border: '1px solid var(--fs-surface-2)',
    }}
  >
    <SkeletonBox height={60} width={60} borderRadius="lg" />
    <div className="flex-1 space-y-2">
      <SkeletonBox height={18} width="70%" />
      <SkeletonBox height={14} width="40%" />
      <div className="flex gap-2">
        <SkeletonBox height={20} width={50} borderRadius="full" />
        <SkeletonBox height={20} width={70} borderRadius="full" />
      </div>
    </div>
  </div>
);

/** Full LibraryScreen skeleton for initial load */
export const LibraryScreenSkeleton: React.FC = () => (
  <div className="screen-shell space-y-4 pb-32 animate-pulse">
    {/* Header skeleton */}
    <div className="px-4 pt-6 space-y-4">
      <SkeletonBox height={32} width={120} />
      {/* Search bar */}
      <SkeletonBox height={48} width="100%" borderRadius="xl" />
      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders, fixed count, never reordered
          <SkeletonBox key={i} height={36} width={80} borderRadius="full" />
        ))}
      </div>
    </div>

    {/* Library items skeleton */}
    <div className="px-4 space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders, fixed count, never reordered
        <SkeletonLibraryItem key={i} />
      ))}
    </div>
  </div>
);

// ========================================
// PasswordManagerScreen Skeleton
// ========================================

/** Password item skeleton */
export const SkeletonPasswordItem: React.FC = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: 16,
      background: 'var(--fs-surface)',
      border: '1px solid var(--fs-surface-2)',
    }}
  >
    <SkeletonCircle size={40} />
    <div className="flex-1 space-y-2">
      <SkeletonBox height={18} width="50%" />
      <SkeletonBox height={14} width="70%" />
    </div>
    <SkeletonBox height={32} width={32} borderRadius="lg" />
  </div>
);

/** Full PasswordManagerScreen skeleton for initial load */
export const PasswordManagerScreenSkeleton: React.FC = () => (
  <div className="screen-shell space-y-4 pb-32 animate-pulse">
    {/* Header skeleton */}
    <div className="px-4 pt-6 space-y-4">
      <div className="flex items-center justify-between">
        <SkeletonBox height={32} width={150} />
        <SkeletonBox height={40} width={40} borderRadius="lg" />
      </div>
      {/* Search bar */}
      <SkeletonBox height={48} width="100%" borderRadius="xl" />
    </div>

    {/* Password items skeleton */}
    <div className="px-4 space-y-3">
      {Array.from({ length: 8 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders, fixed count, never reordered
        <SkeletonPasswordItem key={i} />
      ))}
    </div>
  </div>
);

// ========================================
// AddScreen Skeleton
// ========================================

/** Full AddScreen skeleton for initial load */
export const AddScreenSkeleton: React.FC = () => (
  <div className="screen-shell space-y-6 pb-32 animate-pulse">
    {/* Header skeleton */}
    <div className="px-4 pt-6">
      <SkeletonBox height={32} width={120} />
    </div>

    {/* Type selector skeleton */}
    <div className="px-4">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders, fixed count, never reordered
            key={i}
            style={{
              background: 'var(--fs-surface)',
              border: '1px solid var(--fs-surface-2)',
              boxShadow: 'var(--shadow-card)',
              padding: 16,
            }}
          >
            <SkeletonCircle size={48} className="mx-auto" />
            <SkeletonBox height={16} width="80%" className="mx-auto" />
          </div>
        ))}
      </div>
    </div>

    {/* Form skeleton */}
    <div className="px-4 space-y-4">
      <SkeletonBox height={56} width="100%" borderRadius="xl" />
      <SkeletonBox height={120} width="100%" borderRadius="xl" />
      <div className="flex gap-3">
        <SkeletonBox height={48} width="50%" borderRadius="xl" />
        <SkeletonBox height={48} width="50%" borderRadius="xl" />
      </div>
    </div>
  </div>
);

// ========================================
// WorkoutListSkeleton
// ========================================

export function WorkoutListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders, fixed count, never reordered
        <div key={i} className="premium-shimmer h-20" />
      ))}
    </div>
  );
}

// ========================================
// Screen Skeleton Map for AppRouter
// ========================================

import type { Screen } from '../../types';

export const screenSkeletonMap: Record<Screen, React.FC> = {
  today: HomeScreenSkeleton,
  dashboard: HomeScreenSkeleton,
  workout: HomeScreenSkeleton,
  history: FeedScreenSkeleton,
  templates: LibraryScreenSkeleton,
  calendar: CalendarScreenSkeleton,
  settings: SettingsScreenSkeleton,
  library: LibraryScreenSkeleton,
  fitness: LibraryScreenSkeleton,
  add: AddScreenSkeleton,
  login: () => (
    <div className="h-[80vh] flex items-center justify-center">
      <SkeletonCircle size={64} />
    </div>
  ),
  signup: () => (
    <div className="h-[80vh] flex items-center justify-center">
      <SkeletonCircle size={64} />
    </div>
  ),
  insights: LibraryScreenSkeleton,
};

// ========================================
// Legacy Export (for compatibility)
// ========================================
const SkeletonLoader: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <SkeletonList count={count} />
);

export default SkeletonLoader;
