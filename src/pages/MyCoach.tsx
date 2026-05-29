// ============================================================================
// MY COACH — trainee view: assignments inbox, coaches, consent management
// ============================================================================

import { MessageSquare } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { showToast } from '../components/workout/components/ui/Toast';
import { useAuth } from '../contexts/AuthContext';
import {
  acceptInvite,
  disconnectCoach,
  listMyAssignments,
  listMyCoaches,
  subscribeToAssignments,
} from '../services/coach';
import type { Assignment } from '../types/coach';
import { CoachPage, EmptyHint, ListRow, Section, formatDate, useAsyncData } from './coach/_shared';

const KIND_LABEL: Record<Assignment['kind'], string> = {
  program: 'תוכנית אימון',
  nutrition_target: 'יעד תזונה',
  note: 'המלצה',
  announcement: 'הודעה',
};

export default function MyCoach() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    data: coaches,
    loading: coachesLoading,
    reload,
  } = useAsyncData(() => listMyCoaches('active'), []);
  const {
    data: assignments,
    loading: aLoading,
    reload: reloadAssignments,
  } = useAsyncData(() => listMyAssignments(), []);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  // Live inbox: reflect coach actions (program/note/announcement) the moment they land.
  useEffect(() => {
    if (!user?.id) return;
    return subscribeToAssignments(user.id, reloadAssignments);
  }, [user?.id, reloadAssignments]);

  const connect = async () => {
    if (!code.trim()) return;
    setBusy(true);
    const res = await acceptInvite(code);
    setBusy(false);
    if (res.ok) {
      setCode('');
      reload();
      showToast('התחברת למאמן', 'success');
    } else {
      showToast(res.error === 'seat_limit' ? 'למאמן אין מקום פנוי' : 'קוד לא תקין', 'error');
    }
  };

  return (
    <CoachPage title="המאמן שלי" subtitle="My Coach" onBack={() => navigate('/')}>
      <Section title="חיבור למאמן">
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="קוד הזמנה"
            dir="ltr"
            className="flex-1 px-3 py-2"
            style={{
              background: 'var(--fs-surface)',
              border: '1px solid var(--fs-surface-2)',
              color: 'var(--fs-ink)',
              fontFamily: 'var(--font-mono)',
              fontSize: 16,
              letterSpacing: '0.12em',
            }}
          />
          <Button variant="primary" isLoading={busy} onClick={connect}>
            התחבר
          </Button>
        </div>
      </Section>

      <Section title="המאמנים שלי">
        {coachesLoading ? (
          <EmptyHint>טוען…</EmptyHint>
        ) : coaches.length === 0 ? (
          <EmptyHint>עדיין לא התחברת למאמן. הזן קוד הזמנה למעלה.</EmptyHint>
        ) : (
          coaches.map((c) => (
            <ListRow
              key={c.id}
              label={c.coachProfile?.displayName ?? 'מאמן'}
              meta={`מחובר מאז ${formatDate(c.consentAt ?? c.createdAt)}`}
              trailing={
                <div className="flex gap-2">
                  <button
                    type="button"
                    aria-label="הודעה"
                    onClick={() => navigate(`/my-coach/messages/${c.coachId}`)}
                    style={{
                      width: 32,
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'var(--fs-surface-2)',
                      color: 'var(--fs-heading)',
                    }}
                  >
                    <MessageSquare size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await disconnectCoach(c.id);
                      reload();
                      showToast('המאמן נותק', 'success');
                    }}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      color: 'var(--fs-muted)',
                      background: 'transparent',
                      padding: '0 8px',
                    }}
                  >
                    נתק
                  </button>
                </div>
              }
            />
          ))
        )}
      </Section>

      <Section title="נשלח אליי">
        {aLoading ? (
          <EmptyHint>טוען…</EmptyHint>
        ) : assignments.length === 0 ? (
          <EmptyHint>אין המלצות או שיוכים עדיין.</EmptyHint>
        ) : (
          assignments.map((a) => (
            <ListRow
              key={a.id}
              label={a.title || KIND_LABEL[a.kind]}
              meta={`${KIND_LABEL[a.kind]} · ${formatDate(a.createdAt)}${
                typeof a.payload.text === 'string' ? ` · ${a.payload.text}` : ''
              }${typeof a.payload.calories === 'number' ? ` · ${a.payload.calories} קל'` : ''}`}
            />
          ))
        )}
      </Section>
    </CoachPage>
  );
}
