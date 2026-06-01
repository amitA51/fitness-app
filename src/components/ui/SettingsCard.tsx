// SettingsCard — DEPRECATED thin wrapper around the canonical <Card>.
// Preserves the editorial settings-card look (glass surface, asymmetric radius,
// accent rail, magnetic hover) so existing `import SettingsCard` sites keep
// working. New code should use `<Card variant="glass" asymmetric>`.

import type React from 'react';
import { Card } from './Card';

/** @deprecated Use `<Card variant="glass" asymmetric>` from `components/ui/Card`. */
export function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <Card variant="glass" asymmetric interactive noPadding className="fs-accent-rail">
      {children}
    </Card>
  );
}

export default SettingsCard;
