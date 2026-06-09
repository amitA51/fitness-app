// Full-screen skeleton shown while a lazy route chunk loads. Extracted from
// AppRouter to keep that file under the 800-line cap. Pure presentational.
export function PageLoader() {
  return (
    <div
      className="min-h-screen min-h-[100dvh]"
      role="status"
      aria-live="polite"
      aria-label="טוען"
      style={{ background: 'var(--fs-bg)' }}
    >
      <div style={{ padding: '24px 20px' }}>
        <div
          className="animate-shimmer"
          style={{
            height: 120,
            background:
              'linear-gradient(90deg, var(--fs-surface-2) 25%, var(--fs-surface) 50%, var(--fs-surface-2) 75%)',
            backgroundSize: '200% 100%',
            marginBottom: 16,
          }}
        />
        <div
          className="animate-shimmer"
          style={{
            height: 80,
            background:
              'linear-gradient(90deg, var(--fs-surface-2) 25%, var(--fs-surface) 50%, var(--fs-surface-2) 75%)',
            backgroundSize: '200% 100%',
            marginBottom: 16,
          }}
        />
        <div
          className="animate-shimmer"
          style={{
            height: 200,
            background:
              'linear-gradient(90deg, var(--fs-surface-2) 25%, var(--fs-surface) 50%, var(--fs-surface-2) 75%)',
            backgroundSize: '200% 100%',
          }}
        />
      </div>
    </div>
  );
}
