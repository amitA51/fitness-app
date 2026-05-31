// ============================================================================
// MY COACH — trainee view: assignments inbox, coaches, consent management
// ============================================================================

import { MessageSquare, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { showToast } from '../components/ui/GlobalToast';
import { useAuth } from '../contexts/AuthContext';
import { syncTemplatesFromCloud } from '../hooks/useCloudTemplateReflection';
import {
  acceptInvite,
  disconnectCoach,
  listMyAssignments,
  listMyCoaches,
  submitCheckIn,
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
  const [startingId, setStartingId] = useState<string | null>(null);

  // Live inbox: reflect coach actions (program/note/announcement) the moment they land.
  useEffect(() => {
    if (!user?.id) return;
    return subscribeToAssignments(user.id, reloadAssignments);
  }, [user?.id, reloadAssignments]);

  // Start a coach-assigned program: ensure the referenced template is synced
  // into the local-first store, then enter the existing ActiveWorkout flow.
  const startProgram = async (a: Assignment) => {
    if (!a.templateId) return;
    setStartingId(a.id);
    try {
      await syncTemplatesFromCloud();
      navigate(`/workout/${a.templateId}`);
    } catch {
      setStartingId(null);
      showToast('לא ניתן להתחיל את האימון', 'error');
    }
  };

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
                    aria-label="שלח הודעה למאמן"
                    onClick={() => navigate(`/my-coach/messages/${c.coachId}`)}
                    className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--fs-accent)]"
                    style={{
                      width: 44,
                      height: 44,
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
                    className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--fs-accent)]"
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
                      minHeight: 44,
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

      <CheckInForm />

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
              trailing={
                a.kind === 'program' && a.templateId ? (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Play size={14} />}
                    isLoading={startingId === a.id}
                    onClick={() => startProgram(a)}
                  >
                    התחל אימון
                  </Button>
                ) : undefined
              }
            />
          ))
        )}
      </Section>
    </CoachPage>
  );
}

function CheckInForm() {
  const [weight, setWeight] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const inputStyle = {
    background: 'var(--fs-surface)',
    border: '1px solid var(--fs-surface-2)',
    color: 'var(--fs-ink)',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
  };

  const submit = async () => {
    setBusy(true);
    const { error } = await submitCheckIn({
      weight: weight ? Number(weight) : null,
      mood,
      notes,
    });
    setBusy(false);
    if (error) {
      showToast('שמירת הצ׳ק-אין נכשלה', 'error');
      return;
    }
    setWeight('');
    setMood(null);
    setNotes('');
    showToast('הצ׳ק-אין נשמר', 'success');
  };

  return (
    <Section title="צ׳ק-אין שבועי">
      <div className="flex gap-2 mb-2">
        <input
          type="number"
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder='משקל (ק"ג)'
          aria-label="משקל"
          className="flex-1 px-3 py-2"
          style={inputStyle}
        />
        <div className="flex gap-1" role="group" aria-label="מצב רוח">
          {[1, 2, 3, 4, 5].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMood(m)}
              aria-label={`מצב רוח ${m}`}
              aria-pressed={mood === m}
              style={{
                width: 34,
                minHeight: 44,
                background: mood === m ? 'var(--fs-primary)' : 'var(--fs-surface)',
                color: mood === m ? 'var(--fs-accent)' : 'var(--fs-muted)',
                border: '1px solid var(--fs-surface-2)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="איך עבר השבוע?"
        aria-label="הערות צ׳ק-אין"
        className="w-full mb-2 px-3 py-2"
        style={{ ...inputStyle, resize: 'none' }}
      />
      <Button variant="primary" fullWidth isLoading={busy} onClick={submit}>
        שמור צ׳ק-אין
      </Button>
    </Section>
  );
}
