import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { showToast } from '../components/ui/GlobalToast';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { acceptInvite } from '../services/coach';

const STORAGE_KEY = 'pending_invite_code';

function getCode(urlCode: string) {
  if (urlCode) return urlCode;
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim().toUpperCase() || '';
  } catch {
    return '';
  }
}

export default function JoinPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { status } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const didRun = useRef(false);

  const code = getCode(params.get('code')?.trim().toUpperCase() || '');

  // Unauthenticated: stash code and show login prompt
  useEffect(() => {
    if (status === 'unauthenticated' && code) {
      try {
        localStorage.setItem(STORAGE_KEY, code);
      } catch {
        /* */
      }
    }
  }, [status, code]);

  // Authenticated (or guest with user): auto-accept
  useEffect(() => {
    if ((status === 'authenticated' || status === 'guest') && code && !didRun.current) {
      didRun.current = true;
      setBusy(true);
      acceptInvite(code).then((res) => {
        setBusy(false);
        if (res.ok) {
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {
            /* */
          }
          showToast('התחברת למאמן', 'success');
          navigate('/my-coach', { replace: true });
        } else {
          setError(res.error === 'seat_limit' ? 'למאמן אין מקום פנוי' : 'קוד לא תקין');
        }
      });
    }
  }, [status, code, navigate]);

  // Loading state
  if (status === 'loading' || busy) {
    return (
      <div className="flex items-center justify-center min-h-screen" dir="rtl">
        <LoadingSpinner />
      </div>
    );
  }

  // Unauthenticated: prompt to login
  if (status === 'unauthenticated') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6" dir="rtl">
        <h1
          style={{
            fontFamily: 'var(--font-heading)',
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
            color: 'var(--fs-ink-muted)',
            textAlign: 'center',
          }}
        >
          כדי לקבל את ההזמנה, יש להירשם או להתחבר קודם.
        </p>
        <Button variant="primary" onClick={() => navigate('/')}>
          הרשמה / התחברות
        </Button>
      </div>
    );
  }

  // Error state (authenticated but invite failed)
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6" dir="rtl">
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            color: 'var(--fs-danger, #e53e3e)',
          }}
        >
          {error}
        </p>
        <Button variant="ghost" onClick={() => navigate('/')}>
          חזרה
        </Button>
      </div>
    );
  }

  // No code at all
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 px-6" dir="rtl">
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 16,
          color: 'var(--fs-ink-muted)',
        }}
      >
        לא נמצא קוד הזמנה
      </p>
      <Button variant="ghost" onClick={() => navigate('/')}>
        חזרה
      </Button>
    </div>
  );
}
