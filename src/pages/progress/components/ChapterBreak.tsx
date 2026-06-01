// ============================================================================
// ChapterBreak — the editorial section divider used at the top of every tab.
// ============================================================================
// Extracted from the six tabs that each hand-rolled the identical markup. One
// definition keeps the masthead-style chapter rule consistent across Progress.

import { memo } from 'react';

export const ChapterBreak = memo(function ChapterBreak({ title }: { title: string }) {
  return (
    <div className="chapter-break" style={{ marginInline: 'calc(-1 * var(--space-5))' }}>
      <span className="left" />
      <span
        className="right"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 16,
          color: 'var(--fs-ink)',
        }}
      >
        {title}
      </span>
    </div>
  );
});

export default ChapterBreak;
