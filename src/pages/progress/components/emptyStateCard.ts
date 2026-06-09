// ============================================================================
// emptyStateCardStyle — the shared surface for composed Progress empty states.
// ============================================================================
// Mirrors the Overview/Recovery empty-state card (asymmetric radius, surface
// token, card shadow) so every tab's "nothing yet" state reads as one family
// instead of a bare "אין נתונים". Token colors only.

import type { CSSProperties } from 'react';

export const emptyStateCardStyle: CSSProperties = {
  background: 'var(--fs-surface)',
  borderRadius: '22px 16px 22px 16px',
  border: '1px solid var(--fs-surface-2)',
  boxShadow: 'var(--shadow-card)',
  padding: '16px',
  position: 'relative',
  overflow: 'hidden',
};
