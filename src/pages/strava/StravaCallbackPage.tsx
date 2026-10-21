import { CheckCircle2, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { type StravaCallError, finishStravaConnect } from '../../services/strava/stravaApi';
import { rememberStravaLinked } from '../../services/strava/stravaSync';
import { logger } from '../../utils/logger';

// ============================================================================
// /strava/callback — where Strava sends the user after "Authorize".
// ============================================================================
// Rendered before every auth gate (see AppRouter): on an iPhone this page opens
// in Safari, where the installed app's login does not exist. The one-time
// `state` from the URL is what ties the link to the account, so no login is
// needed here. The installed app notices the new link when it comes back to
// the foreground.

type Outcome = 'working' | 'done' | 'cancelled' | StravaCallError;

const FAILURE_TEXT: Partial<Record<Outcome, string>> = {
  cancelled: 'החיבור בוטל, כי לא אישרתם אותו ב-Strava.',
  scope:
    'כדי לייבא אימונים צריך לאשר ב-Strava גישה לפעילויות. התחילו שוב מההגדרות והשאירו את התיבה מסומנת.',
  expired: 'הקישור כבר לא בתוקף. התחילו שוב מההגדרות באפליקציה.',
  offline: 'אין חיבור לאינטרנט. התחברו ונסו שוב מההגדרות באפליקציה.',
};

const GENERIC_FAILURE = 'החיבור נכשל. נסו שוב מההגדרות באפליקציה.';

export default function StravaCallbackPage() {
  const [outcome, setOutcome] = useState<Outcome>('working');
  const started = useRef(false);

  useEffect(() => {
    // StrictMode mounts twice in development; the code can be spent only once.
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    // A reload must not resend a spent code.
    window.history.replaceState(null, '', window.location.pathname);

    const code = params.get('code');
    const state = params.get('state');
    if (params.get('error') || !code || !state) {
      setOutcome(params.get('error') ? 'cancelled' : 'invalid');
      return;
    }
    finishStravaConnect(code, state, params.get('scope') ?? '')
      .then((res) => {
        if (res.ok) {
          rememberStravaLinked(true);
          setOutcome('done');
        } else {
          setOutcome(res.error);
        }
      })
      .catch((err: unknown) => {
        logger.sync.error('strava: finishing the connect failed', err);
        setOutcome('failed');
      });
  }, []);

  const done = outcome === 'done';
  const Icon = done ? CheckCircle2 : XCircle;

  return (
    <main
      dir="rtl"
      className="min-h-screen min-h-[100dvh] flex items-center justify-center"
      style={{ background: 'var(--fs-bg)', padding: 'var(--space-6, 24px)' }}
    >
      <div
        aria-live="polite"
        style={{
          maxWidth: 380,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          textAlign: 'center',
        }}
      >
        {outcome === 'working' ? (
          <p style={{ fontFamily: 'var(--font-hebrew)', fontSize: 17, color: 'var(--fs-ink)' }}>
            מחברים את Strava...
          </p>
        ) : (
          <>
            <Icon
              size={44}
              aria-hidden="true"
              style={{ margin: '0 auto', color: done ? 'var(--fs-accent)' : 'var(--color-error)' }}
            />
            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 22,
                color: 'var(--fs-ink)',
                margin: 0,
              }}
            >
              {done ? 'החיבור ל-Strava הצליח' : 'החיבור ל-Strava לא הצליח'}
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: 15,
                lineHeight: 1.6,
                color: 'var(--fs-muted)',
                margin: 0,
              }}
            >
              {done
                ? 'האימונים שלכם ייכנסו לאפליקציה תוך דקה. אפשר לסגור את הדף הזה ולחזור לאפליקציה.'
                : (FAILURE_TEXT[outcome] ?? GENERIC_FAILURE)}
            </p>
            <Button variant="primary" fullWidth onClick={() => window.location.assign('/settings')}>
              {done ? 'פתיחת האפליקציה' : 'חזרה להגדרות'}
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
