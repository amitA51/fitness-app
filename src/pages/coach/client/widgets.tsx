// Fresh Steel / Obsidian design system — client-detail widget primitive (Stat)

export function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      className="px-4 py-3"
      style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-surface-2)' }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '-0.01em',
          color: 'var(--fs-muted)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 20,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: color ?? 'var(--fs-heading)',
        }}
      >
        {/* bdi auto-direction: Hebrew phrase values (e.g. 'פעיל', 'לפני 3 ימים')
            keep RTL while pure-numeric values still render LTR — never force ltr. */}
        <bdi>{value}</bdi>
      </div>
    </div>
  );
}
