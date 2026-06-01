// ============================================================================
// ProgressSkeleton — initial-load placeholder for the Progress screen.
// ============================================================================
// Wired to useProgressData().isLoading (previously returned but unused). Mirrors
// the editorial layout each tab renders: chapter rule, a hero accent-rail card,
// and a trend surface — so the transition to real content is seamless. Built on
// the shared SkeletonBox primitive; no blank screens or stale data.

import type React from 'react';
import { memo } from 'react';
import { SkeletonBox } from '../../../components/ui/SkeletonLoader';

const cardStyle: React.CSSProperties = {
  background: 'var(--fs-surface)',
  borderRadius: 'var(--radius-asymmetric)',
  border: '1px solid var(--fs-surface-2)',
  boxShadow: 'var(--shadow-card)',
  padding: 16,
};

export const ProgressSkeleton = memo(function ProgressSkeleton() {
  return (
    <output
      className="space-y-4"
      aria-live="polite"
      aria-busy="true"
      aria-label="טוען נתוני התקדמות"
      style={{ display: 'block' }}
    >
      {/* Chapter rule */}
      <div className="flex items-center gap-3" style={{ marginBottom: 4 }}>
        <SkeletonBox height={1} width="40%" borderRadius="sm" />
        <SkeletonBox height={18} width={80} borderRadius="sm" />
      </div>

      {/* Hero stat card */}
      <div style={cardStyle}>
        <SkeletonBox height={12} width={120} borderRadius="sm" />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            marginTop: 16,
          }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <SkeletonBox height={28} width="70%" borderRadius="sm" />
              <SkeletonBox height={10} width="90%" borderRadius="sm" />
            </div>
          ))}
        </div>
      </div>

      {/* Trend surface */}
      <div style={cardStyle}>
        <SkeletonBox height={14} width={140} borderRadius="sm" />
        <SkeletonBox
          height={160}
          width="100%"
          borderRadius="var(--radius-asymmetric)"
          className="mt-3"
        />
      </div>

      {/* Secondary list card */}
      <div style={cardStyle}>
        <SkeletonBox height={12} width={100} borderRadius="sm" />
        <div className="space-y-2" style={{ marginTop: 12 }}>
          {[0, 1, 2].map((i) => (
            <SkeletonBox key={i} height={40} width="100%" borderRadius="md" />
          ))}
        </div>
      </div>
    </output>
  );
});

export default ProgressSkeleton;
