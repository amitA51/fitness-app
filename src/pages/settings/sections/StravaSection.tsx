import { Activity, Link2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { SettingsCard } from '../../../components/ui/SettingsCard';
import { SectionLabel } from '../../../components/ui/SettingsSectionLabel';
import { SkeletonBox } from '../../../components/ui/SkeletonLoader';
import {
  type StravaStatus,
  disconnectStrava,
  fetchStravaStatus,
  startStravaConnect,
} from '../../../services/strava/stravaApi';
import {
  STRAVA_PENDING_KEY,
  rememberStravaLinked,
  syncStrava,
} from '../../../services/strava/stravaSync';
import { openExternalLink } from '../../../utils/externalLink';
import { logger } from '../../../utils/logger';
import { isNativePlatform } from '../../../utils/platform';
import { PUBLIC_SITE_ORIGIN } from '../../../utils/publicSite';
import { Divider } from '../components/Divider';
import { IconBox } from '../components/IconBox';

// ============================================================================
// SETTINGS · STRAVA — Garmin → Strava → the app.
// ============================================================================
// Connecting sends the user to Strava and back to /strava/callback. On an
// iPhone that return lands in Safari, so this card re-asks the server whenever
// the app comes back to the foreground; the import itself then runs here and
// in the background hook (useStravaAutoSync).

/** A connect started here is awaited this long (Strava login + approval). */
const PENDING_MS = 30 * 60 * 1000;

const bodyText = {
  fontFamily: 'var(--font-hebrew)',
  fontSize: '13px',
  color: 'var(--fs-muted)',
  lineHeight: 1.5,
} as const;

type LoadState = 'loading' | 'ready' | 'error' | 'not_configured';

function importedText(n: number): string {
  if (n === 0) return 'אין אימונים חדשים';
  if (n === 1) return 'נכנס אימון אחד';
  return `נכנסו ${n} אימונים`;
}

function formatWhen(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('he-IL', {
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const isMobileDevice = (): boolean =>
  typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export function StravaSection() {
  const [load, setLoad] = useState<LoadState>('loading');
  const [status, setStatus] = useState<StravaStatus | null>(null);
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const runImport = useCallback(async () => {
    setBusy('sync');
    setMessage('מייבאים מ-Strava...');
    let result: Awaited<ReturnType<typeof syncStrava>>;
    try {
      result = await syncStrava();
    } catch (err) {
      logger.sync.warn('strava: import from settings failed', err);
      setMessage('הייבוא נכשל. נסו שוב בעוד כמה דקות.');
      return;
    } finally {
      setBusy(null);
    }
    setStatus((s) => (s ? { ...s, lastSyncAt: new Date().toISOString() } : s));
    if (!result.connected) {
      setStatus((s) => (s ? { ...s, connected: false } : s));
      setMessage(null);
      return;
    }
    if (result.error === 'strava_rate_limited') {
      setMessage('Strava עמוסה כרגע. הייבוא ימשיך לבד בעוד שעה.');
    } else if (result.error) {
      setMessage('הייבוא נכשל. נסו שוב בעוד כמה דקות.');
    } else {
      setMessage(importedText(result.imported));
    }
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetchStravaStatus();
    // Back from Strava (approved or cancelled): the connect spinner is over. On
    // an iPhone this page was never unloaded, so it would spin forever.
    setBusy((b) => (b === 'connect' ? null : b));
    if (!res.ok) {
      setLoad(res.error === 'not_configured' ? 'not_configured' : 'error');
      return;
    }
    setStatus(res);
    setLoad('ready');
    rememberStravaLinked(res.connected);
    const pending = Number(localStorage.getItem(STRAVA_PENDING_KEY)) > Date.now();
    if (res.connected && pending) {
      // Back from Strava: the link was just made — bring the history in now.
      localStorage.removeItem(STRAVA_PENDING_KEY);
      void runImport();
    }
  }, [runImport]);

  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const connect = async () => {
    setBusy('connect');
    setMessage(null);
    // In the native apps Strava cannot return to the shell's own origin: the
    // connect runs in the system browser and comes back to the website's
    // return page, which finishes it. Back in the app, the visibility refresh
    // below sees the new link and starts the import.
    const native = isNativePlatform();
    const res = await startStravaConnect(
      `${native ? PUBLIC_SITE_ORIGIN : window.location.origin}/strava/callback`,
      native || isMobileDevice()
    );
    if (!res.ok) {
      setBusy(null);
      setMessage(
        res.error === 'invalid'
          ? 'אי אפשר לחבר מכאן. פתחו את האפליקציה בדפדפן ונסו שוב.'
          : 'לא הצלחנו לפתוח את Strava. נסו שוב.'
      );
      return;
    }
    localStorage.setItem(STRAVA_PENDING_KEY, String(Date.now() + PENDING_MS));
    if (native) {
      await openExternalLink(res.url);
      return;
    }
    window.location.assign(res.url);
  };

  const disconnect = async () => {
    setBusy('disconnect');
    const res = await disconnectStrava();
    setBusy(null);
    setConfirmOpen(false);
    if (!res.ok) {
      logger.sync.warn('strava: disconnect failed', res.error);
      setMessage('הניתוק נכשל. נסו שוב.');
      return;
    }
    rememberStravaLinked(false);
    setStatus((s) => (s ? { ...s, connected: false, athleteName: null } : s));
    setMessage(null);
  };

  const connected = load === 'ready' && status?.connected === true;
  const lastSync = formatWhen(status?.lastSyncAt ?? null);

  return (
    <div className="mb-5">
      <SectionLabel>Strava</SectionLabel>
      <SettingsCard>
        <div className="flex items-center gap-3 ps-4 pe-4 py-3.5 min-h-[52px]">
          <IconBox tone={connected ? 'accent' : 'surface'}>
            {connected ? <Link2 size={15} /> : <Activity size={15} />}
          </IconBox>
          {load === 'loading' ? (
            <SkeletonBox className="flex-1 h-4" />
          ) : (
            <span className="flex-1 flex flex-col" style={{ fontFamily: 'var(--font-hebrew)' }}>
              <span style={{ fontSize: '15px', fontWeight: 500, color: 'var(--fs-ink)' }}>
                {connected ? 'מחובר ל-Strava' : 'ייבוא אימונים מ-Strava'}
              </span>
              {connected && status?.athleteName && (
                <span style={{ fontSize: '13px', color: 'var(--fs-muted)' }}>
                  בחשבון של <bdi>{status.athleteName}</bdi>
                </span>
              )}
            </span>
          )}
        </div>
        <Divider />

        <div
          style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}
        >
          {load === 'not_configured' && <p style={bodyText}>החיבור ל-Strava עוד לא הופעל בשרת.</p>}
          {load === 'error' && (
            <>
              <p style={bodyText}>לא הצלחנו לבדוק את החיבור ל-Strava.</p>
              <Button variant="secondary" fullWidth shape="sharp" onClick={() => void refresh()}>
                נסו שוב
              </Button>
            </>
          )}
          {load === 'ready' && !connected && (
            <>
              <p style={bodyText}>
                ריצות, הליכות, רכיבות ושחייה מהשעון ייכנסו לכאן לבד, כולל כל ההיסטוריה. בשעון Garmin
                צריך לחבר קודם את Garmin Connect ל-Strava.
              </p>
              <Button
                variant="primary"
                fullWidth
                shape="sharp"
                loading={busy === 'connect'}
                loadingLabel="פותחים את Strava..."
                onClick={() => void connect()}
              >
                חיבור ל-Strava
              </Button>
            </>
          )}
          {connected && (
            <>
              <p style={bodyText}>
                אימונים חדשים נכנסים לבד כשפותחים את האפליקציה.
                {lastSync && (
                  <>
                    {' '}
                    בדיקה אחרונה: <bdi dir="ltr">{lastSync}</bdi>
                  </>
                )}
              </p>
              <Button
                variant="secondary"
                fullWidth
                shape="sharp"
                icon={<RefreshCw size={14} aria-hidden="true" />}
                loading={busy === 'sync'}
                loadingLabel="מייבאים..."
                disabled={busy !== null}
                onClick={() => void runImport()}
              >
                ייבוא עכשיו
              </Button>
              <Button
                variant="ghost"
                fullWidth
                shape="sharp"
                disabled={busy !== null}
                onClick={() => setConfirmOpen(true)}
              >
                ניתוק
              </Button>
            </>
          )}
          <div aria-live="polite">
            {message && <p style={{ ...bodyText, color: 'var(--fs-ink)' }}>{message}</p>}
          </div>
        </div>
      </SettingsCard>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="לנתק את Strava?"
        description="אימונים שכבר נכנסו יישארו באפליקציה. אימונים חדשים כבר לא ייכנסו."
        confirmLabel="ניתוק"
        cancelLabel="ביטול"
        variant="danger"
        isPending={busy === 'disconnect'}
        pendingLabel="מנתקים..."
        onConfirm={() => void disconnect()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

export default StravaSection;
