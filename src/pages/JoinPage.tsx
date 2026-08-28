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
import { acceptInvite } from '../services/coach';
import { inviteErrorMessage } from './coach/useAcceptInvite';

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

  // Single accept path, callable from both the auto-run effect and the retry CTA.
  const runAccept = useCallback(async () => {
    setError('');
    setBusy(true);
    const res = await acceptInvite(code);
    setBusy(false);
    if (res.ok) {
      // The continuation has been consumed: clear it so the router stops
      // redirecting back to /join and a brand-new account can reach onboarding.
      clearInviteContinuation();
      trackFunnel('coach_invite_accepted');
      showToast('מחובר למאמן', 'success');
      navigate('/my-coach', { replace: true });
    } else {
      setError(inviteErrorMessage(res.error));
    }
  }, [code, navigate]);

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
            נסה שוב
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
