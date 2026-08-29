import { Check, Cloud, CloudOff, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import { Divider } from '../components/Divider';
import { IconBox } from '../components/IconBox';

// ============================================================================
// SETTINGS · CLOUD SYNC — connection status + the ONE sync everyone needs.
// ============================================================================
// The directional `העלה לענן` / `הורד מענן` pair moved to
// `CloudSyncDirectional`, rendered behind the group's `מתקדם` expander: a user
// who knows which direction they need is not the user complaining about
// clutter, and `סנכרון מלא` alone serves everyone else.
//
// `busy` is true while ANY sync (full, up or down) is in flight, so the two
// cards cannot fire concurrent syncs even though they now live apart.

interface Props {
  cloudConnected: boolean;
  /** True while any sync — full, up or down — is in flight. */
  busy: boolean;
  isSyncingAll: boolean;
  syncMessage: string | null;
  pendingSyncCount: number;
  lastSyncTime: string | null;
  onSyncAll: () => void;
}

export function CloudSyncSection({
  cloudConnected,
  busy,
  isSyncingAll,
  syncMessage,
  pendingSyncCount,
  lastSyncTime,
  onSyncAll,
}: Props) {
  const disabled = busy || !cloudConnected;

  return (
    <div className="mb-5">
      <SectionLabel>סנכרון ענן</SectionLabel>
      <SettingsCard>
        {/* Connection Status Row */}
        <div className="flex items-center gap-3 ps-4 pe-4 py-3.5 min-h-[52px]">
          <IconBox tone={cloudConnected ? 'accent' : 'surface'}>
            {cloudConnected ? <Cloud size={15} /> : <CloudOff size={15} />}
          </IconBox>
          <span
            className="flex-1 flex items-center gap-2"
            style={{
              fontFamily: 'var(--font-hebrew)',
              fontSize: '15px',
              fontWeight: 500,
              color: 'var(--fs-ink)',
            }}
          >
            {/* Static accent dot — not the animated/lime breathing-dot: blinking
                "live" indicators are an anti-slop fingerprint and the lime signal
                is reserved for PRs/celebration. */}
            {cloudConnected && (
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: 'var(--fs-accent)',
                  flexShrink: 0,
                }}
              />
            )}
            {cloudConnected ? 'מחובר לענן' : 'לא מחובר'}
          </span>
          {syncMessage && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '-0.01em',
                color: 'var(--fs-accent)',
              }}
              aria-live="polite"
            >
              {syncMessage}
            </span>
          )}
        </div>
        <Divider />

        {/* Status Info Row */}
        <div className="px-4 py-3 flex flex-wrap gap-x-6 gap-y-2">
          {/* Pending Sync Count */}
          <div className="flex items-center gap-2">
            <RefreshCw size={12} style={{ color: 'var(--fs-muted)' }} />
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: pendingSyncCount > 0 ? 'var(--fs-accent)' : 'var(--fs-muted)',
                fontWeight: pendingSyncCount > 0 ? 600 : 400,
              }}
            >
              בהמתנה: {pendingSyncCount}
            </span>
          </div>

          {/* Last Sync Time */}
          {lastSyncTime && (
            <div className="flex items-center gap-2">
              <Check size={12} style={{ color: 'var(--fs-muted)' }} />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--fs-muted)',
                }}
              >
                סנכרון אחרון: {lastSyncTime}
              </span>
            </div>
          )}
        </div>

        {/* Action */}
        <Divider />
        <div
          style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}
        >
          {/* Disconnected: the button below is disabled, so explain the path
              instead of leaving a dead end. */}
          {!cloudConnected && (
            <p
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: '13px',
                color: 'var(--fs-muted)',
                lineHeight: 1.5,
              }}
            >
              התחברו לחשבון כדי לסנכרן את הנתונים עם הענן.
            </p>
          )}

          {/* Sync All — the section's single primary; refresh icon = two-way sync. */}
          <Button
            variant="primary"
            fullWidth
            shape="sharp"
            disabled={disabled}
            icon={<RefreshCw size={14} aria-hidden="true" />}
            onClick={onSyncAll}
          >
            {isSyncingAll ? 'מסנכרנים...' : 'סנכרון מלא'}
          </Button>
        </div>
      </SettingsCard>
    </div>
  );
}

export default CloudSyncSection;
