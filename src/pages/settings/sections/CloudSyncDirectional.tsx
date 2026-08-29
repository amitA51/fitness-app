// ============================================================================
// SETTINGS · DIRECTIONAL SYNC — the expert half of CloudSyncSection.
// ============================================================================
// `העלה לענן` / `הורד מענן` force sync in one direction, overriding the normal
// two-way reconcile. That is an expert affordance: a user who knows which
// direction they need is not the user complaining about clutter, so this sits
// behind the group's `מתקדם` expander while `סנכרון מלא` stays top level.
//
// `busy` covers a full sync too, so opening מתקדם mid-sync cannot start a
// second, conflicting one.

import { Download, Upload } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { SettingsCard } from '../../../components/ui/SettingsCard';

interface Props {
  cloudConnected: boolean;
  /** True while any sync — full, up or down — is in flight. */
  busy: boolean;
  isSyncingUp: boolean;
  isSyncingDown: boolean;
  onSyncToCloud: () => void;
  onPullFromCloud: () => void;
}

export function CloudSyncDirectional({
  cloudConnected,
  busy,
  isSyncingUp,
  isSyncingDown,
  onSyncToCloud,
  onPullFromCloud,
}: Props) {
  const disabled = busy || !cloudConnected;

  return (
    <SettingsCard>
      <div style={{ padding: '12px 16px' }}>
        <p
          style={{
            fontFamily: 'var(--font-hebrew)',
            fontSize: '13px',
            color: 'var(--fs-muted)',
            lineHeight: 1.5,
            marginBottom: '10px',
            textAlign: 'start',
          }}
        >
          סנכרון בכיוון אחד. בחרו בזה רק אם אתם יודעים איזה צד מעודכן — הצד השני יידרס.
        </p>

        {/* Directional pair — equal secondary siblings, mirrored up/down icons */}
        <div className="flex gap-2">
          <div className="flex-1">
            <Button
              variant="secondary"
              fullWidth
              shape="sharp"
              disabled={disabled}
              icon={<Upload size={14} aria-hidden="true" />}
              onClick={onSyncToCloud}
            >
              {isSyncingUp ? 'מעלים...' : 'העלו לענן'}
            </Button>
          </div>
          <div className="flex-1">
            <Button
              variant="secondary"
              fullWidth
              shape="sharp"
              disabled={disabled}
              icon={<Download size={14} aria-hidden="true" />}
              onClick={onPullFromCloud}
            >
              {isSyncingDown ? 'מביאים...' : 'הורידו מענן'}
            </Button>
          </div>
        </div>
      </div>
    </SettingsCard>
  );
}

export default CloudSyncDirectional;
