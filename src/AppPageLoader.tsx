// Full-screen skeleton shown while a lazy route chunk loads. Extracted from
// AppRouter to keep that file under the 800-line cap. Pure presentational.
//
// The silhouette mirrors the real page chrome (a masthead bar + two stacked
// card blocks) so the loading shape is CONTINUOUS with the final render instead
// of a generic three-bar shimmer that re-flows when content arrives. An optional
// `variant` tunes the silhouette to the broad page family (list vs. detail) for
// the routes where that shape differs enough to matter.

const SHIMMER_BG =
  'linear-gradient(90deg, var(--fs-surface-2) 25%, var(--fs-surface) 50%, var(--fs-surface-2) 75%)';

/** Broad page-shape families a route can resolve to. */
export type PageLoaderVariant = 'default' | 'list' | 'detail';

interface PageLoaderProps {
  /** Page-shape family — picks the body silhouette. Defaults to a balanced shape. */
  variant?: PageLoaderVariant;
}

function ShimmerBlock({ height, radius = 0 }: { height: number; radius?: number }) {
  return (
    <div
      className="animate-shimmer"
      style={{
        height,
        borderRadius: radius,
        background: SHIMMER_BG,
        backgroundSize: '200% 100%',
        marginBottom: 16,
      }}
    />
  );
}

/** Masthead bar + body silhouette keyed to the page family. */
export function PageLoader({ variant = 'default' }: PageLoaderProps) {
  return (
    <div
      className="min-h-screen min-h-[100dvh]"
      role="status"
      aria-live="polite"
      aria-label="טוען"
      style={{ background: 'var(--fs-bg)' }}
    >
      <div style={{ padding: '24px 20px' }}>
        {/* Masthead bar — the solid block every screen opens with. */}
        <ShimmerBlock height={104} />

        {variant === 'list' ? (
          // List family (history, rosters): a stack of short rows.
          <>
            <ShimmerBlock height={64} radius={8} />
            <ShimmerBlock height={64} radius={8} />
            <ShimmerBlock height={64} radius={8} />
          </>
        ) : variant === 'detail' ? (
          // Detail family: one tall hero block + a shorter supporting block.
          <>
            <ShimmerBlock height={220} radius={8} />
            <ShimmerBlock height={96} radius={8} />
          </>
        ) : (
          // Default: a 2-card silhouette mirroring typical page chrome.
          <>
            <ShimmerBlock height={96} radius={8} />
            <ShimmerBlock height={180} radius={8} />
          </>
        )}
      </div>
    </div>
  );
}
