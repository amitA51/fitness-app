import { ArrowUpFromLine, Check, Cloud, CloudOff, Download, RefreshCw } from 'lucide-react';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { DIVIDER_STYLE } from '../types';

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
        <div className="flex items-center gap-3 px-4 py-3.5 min-h-[52px]">
          <div
            className="w-8 h-8 flex items-center justify-center shrink-0"
            style={{
              background: cloudConnected ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
              color: cloudConnected ? 'var(--fs-primary)' : 'var(--fs-muted)',
              borderRadius: 0,
            }}
          >
            {cloudConnected ? <Cloud size={15} /> : <CloudOff size={15} />}
          </div>
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
        <div style={DIVIDER_STYLE} />

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
        <div style={DIVIDER_STYLE} />
        <div
          style={{
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {/* Sync All Button - Primary */}
          <button
            type="button"
            onClick={onSyncAll}
            disabled={disabled}
            style={{
              minHeight: '44px',
              padding: '12px',
              fontSize: '13px',
              borderRadius: 0,
              fontFamily: 'var(--font-hebrew)',
              fontWeight: 600,
              border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              opacity: disabled ? 0.5 : 1,
              background: 'var(--fs-primary)',
              color: 'var(--fs-accent)',
            }}
          >
            <ArrowUpFromLine size={14} />
            סנכרון מלא
          </button>

          {/* Individual Sync Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSyncToCloud}
              disabled={disabled}
              style={{
                flex: 1,
                minHeight: '44px',
                padding: '12px',
                fontSize: '12px',
                borderRadius: 0,
                fontFamily: 'var(--font-hebrew)',
                fontWeight: 600,
                border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: disabled ? 0.5 : 1,
                background: 'var(--fs-primary)',
                color: 'var(--fs-accent)',
              }}
            >
              <RefreshCw size={14} />
              {isSyncingUp ? 'מעלה...' : 'העלה לענן'}
            </button>
            <button
              type="button"
              onClick={onPullFromCloud}
              disabled={disabled}
              style={{
                flex: 1,
                minHeight: '44px',
                padding: '12px',
                fontSize: '12px',
                borderRadius: 0,
                fontFamily: 'var(--font-hebrew)',
                fontWeight: 600,
                border: '1px solid var(--fs-primary)',
                cursor: disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                opacity: disabled ? 0.5 : 1,
                background: 'transparent',
                color: 'var(--fs-ink)',
              }}
            >
              <Download size={14} />
              {isSyncingDown ? 'מביא...' : 'הורד מענן'}
            </button>
          </div>
        </div>
      </SettingsCard>
    </div>
  );
}
