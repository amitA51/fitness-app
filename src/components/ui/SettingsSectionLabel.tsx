import type React from 'react';

/** Section header — Hebrew display heading */
export function SectionLabel({
  children,
  num,
  titleEn,
}: {
  children: React.ReactNode;
  num?: string;
  titleEn?: string;
}) {
  // num and titleEn kept for API compat but no longer rendered as eyebrow
  void num;
  void titleEn;
  return (
    <h3
      className="mb-3 px-1"
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 16,
        color: 'var(--fs-ink)',
      }}
    >
      {children}
    </h3>
  );
}

export default SectionLabel;
