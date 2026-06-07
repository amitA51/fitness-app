// Fresh Steel / Obsidian design system — client-detail widget primitives (VolumeTrend, Stat)

const WEEK_LABELS = ['לפני 3ש׳', 'לפני 2ש׳', 'שבוע שעבר', 'השבוע'];

export function VolumeTrend({ weeks }: { weeks: number[] }) {
  const max = Math.max(1, ...weeks);
  return (
    <div
      className="flex items-end gap-2"
      style={{ height: 72 }}
      role="img"
      aria-label="מגמת נפח אימונים, 4 שבועות אחרונים"
    >
      {WEEK_LABELS.map((lbl, i) => (
        <div
          key={lbl}
          className="flex-1 flex flex-col items-center justify-end"
          style={{ height: '100%' }}
        >
          <div
            style={{
              width: '100%',
              height: `${Math.round(((weeks[i] ?? 0) / max) * 100)}%`,
              minHeight: 3,
              background: 'var(--fs-accent)',
            }}
            title={`${Math.round(weeks[i] ?? 0)} ק"ג`}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--fs-muted)',
              marginTop: 6,
              whiteSpace: 'nowrap',
            }}
          >
            {lbl}
          </span>
        </div>
      ))}
    </div>
  );
}

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
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
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
        <span dir="ltr">{value}</span>
      </div>
    </div>
  );
}
