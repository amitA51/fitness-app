/**
 * Tiny app footer. The old static "data/version" card was removed; data
 * controls (export/sync/delete) now live under the "פרטיות ונתונים" category.
 */
export function DataAboutSection() {
  return (
    <p
      className="text-center mt-2 mb-1"
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '11px',
        letterSpacing: '0.14em',
        color: 'var(--fs-muted)',
      }}
    >
      SPARKOS FITNESS · v1.0.0
    </p>
  );
}
