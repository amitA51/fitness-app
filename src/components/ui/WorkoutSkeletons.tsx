// ============================================================================
// SPARKOS FITNESS - Workout-Specific Skeleton Loaders
// Fresh Steel / Obsidian · dark masthead · surface · accent
// ============================================================================

import type { FC } from 'react';

// ========================================
// Base Skeleton Primitives
// Premium shimmer surface — single source of truth via .premium-shimmer
// ========================================

const SkeletonBox: FC<{
  width?: string | number;
  height?: string | number;
  className?: string;
  borderRadius?: string | number;
}> = ({ width = '100%', height = 20, className = '', borderRadius = 0 }) => (
  <div
    className={`premium-shimmer ${className}`.trim()}
    style={{
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
      borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
    }}
  />
);

const SkeletonCircle: FC<{ size?: number; className?: string }> = ({
  size = 40,
  className = '',
}) => (
  <div
    className={`premium-shimmer ${className}`.trim()}
    style={{
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: '50%',
    }}
  />
);

// ========================================
// Dashboard Skeleton
// ========================================

export const DashboardSkeleton: FC = () => (
  <div
    className="pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))]"
    dir="rtl"
    style={{ background: 'var(--fs-bg)' }}
  >
    {/* Greeting */}
    <div style={{ padding: '24px 20px 0' }}>
      <SkeletonBox height={12} width="30%" className="mb-3" />
      <SkeletonBox height={48} width="60%" className="mb-2" />
      <SkeletonBox height={14} width="40%" />
    </div>

    {/* Streak */}
    <div style={{ padding: '16px 20px' }}>
      <SkeletonBox height={64} borderRadius={0} />
    </div>

    {/* Main Content */}
    <div style={{ padding: '0 20px 28px' }}>
      {/* AI Insight Card */}
      <div style={{ marginBottom: 20 }}>
        <SkeletonBox height={120} borderRadius={0} />
      </div>

      {/* Weekly Stats Block */}
      <div style={{ marginBottom: 20 }}>
        <SkeletonBox height={100} borderRadius={0} />
      </div>

      {/* Template Quick Start */}
      <div style={{ marginBottom: 20 }}>
        <SkeletonBox height={56} borderRadius={0} />
      </div>

      {/* Template Strip */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, overflow: 'hidden' }}>
          {[1, 2, 3].map((i) => (
            <SkeletonBox key={i} width={120} height={80} borderRadius={0} />
          ))}
        </div>
      </div>

      {/* Recommendations */}
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            background: 'var(--fs-primary)',
            padding: '12px 16px',
            marginBottom: 12,
          }}
        >
          <SkeletonBox height={10} width="40%" className="mb-2" />
          <SkeletonBox height={14} width="60%" />
        </div>
        <div style={{ border: '2px solid var(--fs-primary)', padding: 16 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                paddingBottom: 16,
                marginBottom: 12,
                borderBottom: '1px solid var(--fs-surface-2)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <SkeletonBox height={20} width="50%" />
                <SkeletonBox height={14} width="20%" />
              </div>
              <SkeletonBox height={8} />
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Grid */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            background: 'var(--fs-primary)',
            padding: '12px 16px',
            marginBottom: 12,
          }}
        >
          <SkeletonBox height={10} width="30%" />
        </div>
        <div style={{ border: '2px solid var(--fs-primary)', padding: 16 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: 8,
              marginBottom: 16,
            }}
          >
            {Array.from({ length: 7 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholders, fixed count, never reordered
              <div key={i} style={{ textAlign: 'center' }}>
                <SkeletonCircle size={32} className="mx-auto" />
              </div>
            ))}
          </div>
          <SkeletonBox height={8} />
        </div>
      </div>
    </div>
  </div>
);

// ========================================
// Workout Screen Skeleton
// ========================================

export const WorkoutSkeleton: FC = () => (
  <div dir="rtl" style={{ background: 'var(--fs-primary)', minHeight: '100vh' }}>
    {/* Masthead */}
    <div
      style={{
        background: 'var(--fs-primary)',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <div>
        <SkeletonBox height={18} width={120} className="mb-2" />
        <SkeletonBox height={10} width={80} />
      </div>
      <SkeletonCircle size={36} />
    </div>

    {/* Hero Section */}
    <div
      style={{
        background: 'var(--fs-primary)',
        textAlign: 'center',
        padding: '40px 20px',
      }}
    >
      <SkeletonBox height={120} width="60%" className="mx-auto" />
      <SkeletonBox height={10} width="30%" className="mx-auto mt-4" />
    </div>

    {/* Sets Section */}
    <div style={{ padding: '16px 20px', background: 'var(--fs-bg)' }}>
      <SkeletonBox height={10} width="40%" className="mb-4" />
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 0',
            borderBottom: '1px solid var(--fs-surface-2)',
          }}
        >
          <SkeletonBox height={24} width={40} />
          <SkeletonBox height={16} width="50%" />
          <SkeletonCircle size={24} />
        </div>
      ))}
    </div>

    {/* Input Section */}
    <div style={{ padding: '20px', background: 'var(--fs-accent)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <SkeletonBox height={56} />
        <SkeletonBox height={56} />
      </div>
      <SkeletonBox height={52} className="mt-4" />
    </div>
  </div>
);

// ========================================
// Progress Page Skeleton
// ========================================

export const ProgressSkeleton: FC = () => (
  <div
    className="pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))]"
    dir="rtl"
    style={{ background: 'var(--fs-bg)' }}
  >
    <div style={{ padding: '24px 20px' }}>
      {/* Header */}
      <SkeletonBox height={12} width="25%" className="mb-3" />
      <SkeletonBox height={40} width="50%" className="mb-2" />

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '24px 0' }}>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              border: '2px solid var(--fs-primary)',
              padding: 16,
              textAlign: 'center',
            }}
          >
            <SkeletonBox height={36} width="60%" className="mx-auto mb-2" />
            <SkeletonBox height={10} width="80%" className="mx-auto" />
          </div>
        ))}
      </div>

      {/* Chart Placeholder */}
      <div style={{ border: '2px solid var(--fs-primary)', padding: 20, marginBottom: 24 }}>
        <SkeletonBox height={200} />
      </div>

      {/* Recent PRs */}
      <div style={{ border: '2px solid var(--fs-primary)', padding: 16 }}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 0',
              borderBottom: '1px solid var(--fs-surface-2)',
            }}
          >
            <SkeletonCircle size={40} />
            <div style={{ flex: 1 }}>
              <SkeletonBox height={16} width="60%" className="mb-2" />
              <SkeletonBox height={12} width="40%" />
            </div>
            <SkeletonBox height={20} width={60} />
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ========================================
// Nutrition Page Skeleton
// ========================================

export const NutritionSkeleton: FC = () => (
  <div
    className="pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))]"
    dir="rtl"
    style={{ background: 'var(--fs-bg)' }}
  >
    <div style={{ padding: '24px 20px' }}>
      {/* Header */}
      <SkeletonBox height={12} width="20%" className="mb-3" />
      <SkeletonBox height={40} width="40%" className="mb-4" />

      {/* Macro Summary */}
      <div
        style={{
          background: 'var(--fs-primary)',
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {['קלוריות', 'חלבונים', 'פחמימות'].map((label) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <SkeletonBox height={28} width="70%" className="mx-auto mb-2" />
              <SkeletonBox height={10} width="50%" className="mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* Meals List */}
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            border: '2px solid var(--fs-primary)',
            padding: 16,
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <SkeletonBox height={16} width="30%" />
            <SkeletonBox height={14} width="20%" />
          </div>
          <SkeletonBox height={60} />
        </div>
      ))}
    </div>
  </div>
);

// ========================================
// Settings Page Skeleton
// ========================================

export const SettingsSkeleton: FC = () => (
  <div
    className="pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))]"
    dir="rtl"
    style={{ background: 'var(--fs-bg)' }}
  >
    <div style={{ padding: '24px 20px' }}>
      {/* Header */}
      <SkeletonBox height={12} width="25%" className="mb-3" />
      <SkeletonBox height={40} width="40%" className="mb-6" />

      {/* Settings Sections */}
      {[1, 2, 3].map((section) => (
        <div key={section} style={{ marginBottom: 24 }}>
          <SkeletonBox height={10} width="20%" className="mb-3" />
          <div style={{ border: '2px solid var(--fs-primary)' }}>
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 16px',
                  borderBottom: item < 3 ? '1px solid var(--fs-surface-2)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <SkeletonCircle size={24} />
                  <SkeletonBox height={14} width={100} />
                </div>
                <SkeletonBox height={24} width={48} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ========================================
// Templates Page Skeleton
// ========================================

export const TemplatesSkeleton: FC = () => (
  <div
    className="pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))]"
    dir="rtl"
    style={{ background: 'var(--fs-bg)' }}
  >
    <div style={{ padding: '24px 20px' }}>
      {/* Header */}
      <SkeletonBox height={12} width="25%" className="mb-3" />
      <SkeletonBox height={40} width="50%" className="mb-6" />

      {/* Template Cards */}
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            border: '2px solid var(--fs-primary)',
            padding: 16,
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <SkeletonBox height={20} width={120} className="mb-2" />
              <SkeletonBox height={12} width={80} />
            </div>
            <SkeletonCircle size={32} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3].map((tag) => (
              <SkeletonBox key={tag} height={24} width={60} />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ========================================
// History Page Skeleton
// ========================================

export const HistorySkeleton: FC = () => (
  <div
    className="pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))]"
    dir="rtl"
    style={{ background: 'var(--fs-bg)' }}
  >
    <div style={{ padding: '24px 20px' }}>
      {/* Header */}
      <SkeletonBox height={12} width="25%" className="mb-3" />
      <SkeletonBox height={40} width="40%" className="mb-6" />

      {/* Workout List */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          style={{
            border: '2px solid var(--fs-primary)',
            padding: 16,
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <SkeletonBox height={18} width={100} className="mb-2" />
              <SkeletonBox height={12} width={60} />
            </div>
            <SkeletonBox height={24} width={60} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[1, 2, 3].map((tag) => (
              <SkeletonBox key={tag} height={20} width={50} />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ========================================
// Screen Skeleton Map
// ========================================

export const screenSkeletonMap: Record<string, FC> = {
  dashboard: DashboardSkeleton,
  workout: WorkoutSkeleton,
  progress: ProgressSkeleton,
  nutrition: NutritionSkeleton,
  settings: SettingsSkeleton,
  templates: TemplatesSkeleton,
  history: HistorySkeleton,
};
