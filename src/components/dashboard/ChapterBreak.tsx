interface ChapterBreakProps {
  number: string;
  title: string;
  subtitle: string;
  style?: React.CSSProperties;
}

export function ChapterBreak({ number, title, subtitle, style }: ChapterBreakProps) {
  return (
    <div
      className="chapter-break"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--fs-muted)',
        padding: '6px 0',
        borderBottom: '1px solid var(--fs-surface-2)',
        ...style,
      }}
    >
      <span className="left">
        {number} · {title}
      </span>
      <span className="right">{subtitle}</span>
    </div>
  );
}
