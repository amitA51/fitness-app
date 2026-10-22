import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { showToast } from '../components/ui/GlobalToast';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { useCoach } from '../contexts/CoachContext';
import { trackFunnel } from '../services/analytics/funnel';
import {
  clearInviteContinuation,
  getPendingInviteCode,
  rememberInviteContinuation,
} from '../services/authContinuation';
import { type AcceptResult, acceptInvite } from '../services/coach';
import { withTimeout } from '../utils/withTimeout';
import { inviteErrorMessage } from './coach/useAcceptInvite';

/** How long the invite screen spins before offering a retry. Accepting runs
 * real work in an edge function, so this is longer than a plain read's cap. */
const ACCEPT_WAIT_MS = 15_000;

function getCode(urlCode: string) {
  return urlCode || getPendingInviteCode() || '';
}

export default function JoinPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { status } = useAuth();
  const code = getCode(params.get('code')?.trim().toUpperCase() || '');

  useEffect(() => {
    if (status === 'unauthenticated' && code) {
      rememberInviteContinuation(code);
    }
  }, [status, code]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen min-h-[100dvh]" dir="rtl">
        <LoadingSpinner />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen min-h-[100dvh] gap-4 px-6"
        dir="rtl"
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            color: 'var(--fs-ink)',
          }}
        >
          הוזמנת להתחבר למאמן
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            color: 'var(--fs-muted)',
            textAlign: 'center',
          }}
        >
          כדי לקבל את ההזמנה, יש להירשם או להתחבר קודם.
        </p>
        <Button
          variant="primary"
          onClick={() => {
            const redirect = rememberInviteContinuation(code);
            navigate(`/login?next=${encodeURIComponent(redirect ?? '/join')}`);
          }}
        >
          הרשמה / התחברות
        </Button>
      </div>
    );
  }

  return <AuthenticatedJoinPage code={code} status={status} />;
}

function AuthenticatedJoinPage({
  code,
  status,
}: {
  code: string;
  status: 'authenticated' | 'guest';
}) {
  const navigate = useNavigate();
  const { isCoach, loading: coachLoading } = useCoach();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const didRun = useRef(false);
  // The accept request still running, if any. A retry after a slow-server
  // timeout joins it instead of sending the same invite a second time.
  const pendingRef = useRef<Promise<AcceptResult> | null>(null);
  const joinedRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleResult = useCallback(
    (res: AcceptResult) => {
      if (joinedRef.current) return;
      if (res.ok) {
        joinedRef.current = true;
        // The continuation has been consumed: clear it so the router stops
        // redirecting back to /join and a brand-new account can reach onboarding.
        // Done even when a late answer lands after the user left this screen.
        clearInviteContinuation();
        trackFunnel('coach_invite_accepted');
        showToast('מחובר למאמן', 'success');
        // Only move the user if they are still here; never yank them elsewhere.
        if (mountedRef.current) navigate('/my-coach', { replace: true });
      } else if (mountedRef.current) {
        setError(inviteErrorMessage(res.error));
      }
    },
    [navigate]
  );

  // Single accept path, callable from both the auto-run effect and the retry CTA.
  // The spinner waits ACCEPT_WAIT_MS at most; after that the screen offers a
  // retry, and if the original request still lands while it is open, the join
  // completes on its own.
  const runAccept = useCallback(async () => {
    setError('');
    setBusy(true);
    if (!pendingRef.current) {
      const started: Promise<AcceptResult> = acceptInvite(code)
        .catch((): AcceptResult => ({ ok: false, error: 'server' }))
        .finally(() => {
          if (pendingRef.current === started) pendingRef.current = null;
        });
      pendingRef.current = started;
    }
    const request = pendingRef.current;
    try {
      const res = await withTimeout(request, ACCEPT_WAIT_MS, 'acceptInvite');
      if (mountedRef.current) setBusy(false);
      handleResult(res);
    } catch {
      void request.then((late) => {
        if (late.ok) handleResult(late);
      });
      if (!mountedRef.current) return;
      setBusy(false);
      setError('השרת לא הגיב בזמן. נסו שוב בעוד רגע.');
    }
  }, [code, handleResult]);

  // Authenticated (or guest with user): auto-accept. Coaches never auto-accept —
  // a coach has no coach of their own (the edge function rejects them too; this
  // is the friendly client-side gate for invite deep links).
  useEffect(() => {
    if (coachLoading || isCoach) return;
    if ((status === 'authenticated' || status === 'guest') && code && !didRun.current) {
      didRun.current = true;
      void runAccept();
    }
  }, [status, code, coachLoading, isCoach, runAccept]);

  // Loading state
  if (coachLoading || busy) {
    return (
      <div className="flex items-center justify-center min-h-screen min-h-[100dvh]" dir="rtl">
        <LoadingSpinner />
      </div>
    );
  }

  // Coach account opened an invite link — explain instead of silently bouncing.
  if (isCoach) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen min-h-[100dvh] gap-4 px-6"
        dir="rtl"
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            color: 'var(--fs-ink)',
          }}
        >
          חשבון מאמן לא יכול להתחבר למאמן אחר
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            color: 'var(--fs-muted)',
            textAlign: 'center',
          }}
        >
          ההזמנה הזו מיועדת למתאמנים. כדי לקבל אותה, יש להתחבר עם חשבון מתאמן.
        </p>
        <Button
          variant="primary"
          onClick={() => {
            // A coach can never consume a trainee invite: drop the continuation
            // so the router stops sending them back here.
            clearInviteContinuation();
            navigate('/coach', { replace: true });
          }}
        >
          למרכז המאמן
        </Button>
      </div>
    );
  }

  // Error state (authenticated but invite failed)
  if (error) {
    const retry = () => {
      didRun.current = false;
      void runAccept();
    };
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen min-h-[100dvh] gap-4 px-6"
        dir="rtl"
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            color: 'var(--color-error)',
            textAlign: 'center',
          }}
        >
          {error}
        </p>
        {code && (
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--fs-muted)',
            }}
          >
            קוד:{' '}
            <bdi dir="ltr" style={{ letterSpacing: '-0.01em' }}>
              {code}
            </bdi>
          </p>
        )}
        <div className="flex flex-col items-center gap-2 w-full max-w-xs">
          <Button variant="primary" fullWidth onClick={retry}>
            נסו שוב
          </Button>
          <Button
            variant="ghost"
            fullWidth
            onClick={() => {
              // Abandoning the deep link must release the continuation, or the
              // router keeps returning the user to this failing screen.
              clearInviteContinuation();
              navigate('/my-coach');
            }}
          >
            להזין קוד ידנית
          </Button>
        </div>
      </div>
    );
  }

  // No code at all
  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen min-h-[100dvh] gap-4 px-6"
      dir="rtl"
    >
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 16,
          color: 'var(--fs-muted)',
        }}
      >
        לא נמצא קוד הזמנה
      </p>
      <Button
        variant="ghost"
        onClick={() => {
          clearInviteContinuation();
          navigate('/');
        }}
      >
        חזרה
      </Button>
    </div>
  );
}
