import { Check, Cloud, CloudOff, Download, RefreshCw, Upload } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { Divider } from '../components/Divider';
import { IconBox } from '../components/IconBox';

interface Props {
  cloudConnected: boolean;
  isSyncingUp: boolean;
  isSyncingDown: boolean;
  isSyncingAll: boolean;
  syncMessage: string | null;
  pendingSyncCount: number;
  lastSyncTime: string | null;
  onSyncToCloud: () => void;
  onPullFromCloud: () => void;
  onSyncAll: () => void;
}

export function CloudSyncSection({
  cloudConnected,
  isSyncingUp,
  isSyncingDown,
  isSyncingAll,
  syncMessage,
  pendingSyncCount,
  lastSyncTime,
  onSyncToCloud,
  onPullFromCloud,
  onSyncAll,
}: Props) {
  const anySyncing = isSyncingAll || isSyncingUp || isSyncingDown;
  const disabled = anySyncing || !cloudConnected;

  return (
    <div className="mb-7">
      <p className="section-title mb-3 px-1">סנכרון ענן</p>
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
            {cloudConnected && <span className="breathing-dot signal" />}
            {cloudConnected ? 'מחובר לענן' : 'לא מחובר'}
          </span>
          {syncMessage && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                letterSpacing: '0.18em',
                color: 'var(--fs-accent)',
                textTransform: 'uppercase',
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

        {/* Action Buttons */}
        <Divider />
        <div
          style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}
        >
          {/* Sync All — the section's single primary; refresh icon = two-way sync */}
          <Button
            variant="primary"
            fullWidth
            shape="sharp"
            disabled={disabled}
            icon={<RefreshCw size={14} aria-hidden="true" />}
            onClick={onSyncAll}
          >
            סנכרון מלא
          </Button>

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
                {isSyncingUp ? 'מעלה...' : 'העלה לענן'}
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
                {isSyncingDown ? 'מביא...' : 'הורד מענן'}
              </Button>
            </div>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
