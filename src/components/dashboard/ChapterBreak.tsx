interface ChapterBreakProps {
  number: string;
  title: string;
  subtitle: string;
  style?: React.CSSProperties;
}

export function ChapterBreak({ number, title, subtitle, style }: ChapterBreakProps) {
  return (
    <div className="chapter-break" style={style}>
      <span className="left">
        {number} · {title}
      </span>
      <span className="right">{subtitle}</span>
    </div>
  );
}
