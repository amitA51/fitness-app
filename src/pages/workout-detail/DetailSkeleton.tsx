/**
 * DetailSkeleton — loading placeholder matching the WorkoutDetail layout shape.
 */

export function DetailSkeleton() {
  return (
    <div style={{ background: 'var(--fs-bg)', animation: 'pulse 1.5s ease-in-out infinite' }}>
      <div className="px-4 pt-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-full" style={{ background: 'var(--fs-surface-2)' }} />
          <div className="flex-1">
            <div
              className="h-6 w-40 rounded-lg mb-2"
              style={{ background: 'var(--fs-surface-2)' }}
            />
            <div className="h-4 w-24 rounded" style={{ background: 'var(--fs-surface-2)' }} />
          </div>
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                background: 'var(--fs-surface)',
                borderRadius: '22px 16px 22px 16px',
                padding: 16,
                height: 96,
              }}
            />
          ))}
        </div>

        {/* Exercise cards skeleton */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                background: 'var(--fs-surface)',
                borderRadius: '22px 16px 22px 16px',
                padding: 16,
                height: 128,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
