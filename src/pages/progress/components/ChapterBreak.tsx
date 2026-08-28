// ============================================================================
// ChapterBreak — deprecated section divider, intentionally renders nothing.
// ============================================================================
// The editorial chapter rule was removed from Progress during the UI refinement
// pass (commit a00d466). The component is kept as a no-op so the remaining tabs
// keep compiling while their markup is migrated; new code must not use it.
//
// Call sites removed: OverviewTab (1), WorkoutsTab (2).
// Call sites REMAINING — delete these three, then delete this file:
//   • tabs/BodyTab.tsx:397, :427
//   • tabs/RecoveryTab.tsx:61
// Both files were outside the scope of the pass that emptied the other three,
// so removing the component now would break the build.

import { memo } from 'react';

/** @deprecated Renders nothing. Remove call sites instead of adding new ones. */
export const ChapterBreak = memo(function ChapterBreak(_props: { title: string }) {
  return null;
});

export default ChapterBreak;
