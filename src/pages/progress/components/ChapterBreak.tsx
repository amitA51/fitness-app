// ============================================================================
// ChapterBreak — deprecated section divider, intentionally renders nothing.
// ============================================================================
// The editorial chapter rule was removed from Progress during the UI refinement
// pass (commit a00d466). The component is kept as a no-op so the six tabs keep
// compiling while their markup is migrated; new code must not use it.

import { memo } from 'react';

/** @deprecated Renders nothing. Remove call sites instead of adding new ones. */
export const ChapterBreak = memo(function ChapterBreak(_props: { title: string }) {
  return null;
});

export default ChapterBreak;
