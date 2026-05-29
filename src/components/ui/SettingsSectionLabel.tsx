import type React from 'react';

/** Editorial chapter-break section header */
export function SectionLabel({
  children,
  num,
  titleEn,
}: {
  children: React.ReactNode;
  num?: string;
  titleEn?: string;
}) {
  if (num) {
    return (
      <div className="chapter-break mb-3" style={{ marginInline: 'calc(-1 * 1rem)' }}>
        <span className="left">
          §{num} · {titleEn}
        </span>
        <span className="right">{children}</span>
      </div>
    );
  }
  return <p className="section-title mb-3 px-1">{children}</p>;
}

export default SectionLabel;
