// ============================================================================
// JOIN — accept a coach invite with explicit consent
// ============================================================================

import { ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { showToast } from '../components/workout/components/ui/Toast';
import { acceptInvite } from '../services/coach';
import { CoachPage, Section } from './coach/_shared';

export default function JoinPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code')?.toUpperCase() ?? '');
  const [busy, setBusy] = useState(false);

  const accept = async () => {
    if (!code.trim()) return;
    setBusy(true);
    const res = await acceptInvite(code);
    setBusy(false);
    if (res.ok) {
      showToast('התחברת למאמן', 'success');
      navigate('/my-coach', { replace: true });
    } else {
      showToast(
        res.error === 'seat_limit' ? 'למאמן אין מקום פנוי' : 'קוד לא תקין או שפג תוקפו',
        'error'
      );
    }
  };

  return (
    <CoachPage title="חיבור למאמן" subtitle="Join" onBack={() => navigate('/')}>
      <Section>
        <div
          className="flex items-start gap-3 px-4 py-4 mb-4"
          style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-surface-2)' }}
        >
          <ShieldCheck
            size={22}
            style={{ color: 'var(--fs-accent)', flexShrink: 0 }}
            aria-hidden="true"
          />
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--fs-ink)',
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            בהתחברות למאמן אתה מאשר לו <strong>לצפות ולערוך</strong> את נתוני האימון והתזונה שלך.
            תוכל לנתק את החיבור בכל רגע ממסך "המאמן שלי", והגישה של המאמן תיחסם מיידית.
          </p>
        </div>

        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="קוד הזמנה"
          dir="ltr"
          className="w-full mb-3 px-3 py-3 text-center"
          style={{
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-surface-2)',
            color: 'var(--fs-ink)',
            fontFamily: 'var(--font-mono)',
            fontSize: 20,
            letterSpacing: '0.2em',
          }}
        />
        <Button variant="primary" fullWidth isLoading={busy} onClick={accept}>
          אני מאשר/ת ומתחבר/ת
        </Button>
      </Section>
    </CoachPage>
  );
}
