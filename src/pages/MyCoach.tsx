// ============================================================================
// MY COACH — trainee view: assignments inbox, coaches, consent management
// ============================================================================

import { MessageSquare, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import EmptyState from '../components/ui/EmptyState';
import { showToast } from '../components/ui/GlobalToast';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { useAuth } from '../contexts/AuthContext';
import { syncTemplatesFromCloud } from '../hooks/useCloudTemplateReflection';
import {
  disconnectCoach,
  listMyAssignments,
  listMyCoaches,
  submitCheckIn,
  subscribeToAssignments,
} from '../services/coach';
import type { Assignment } from '../types/coach';
import {
  CoachPage,
  ListRow,
  ListSkeleton,
  Section,
  formatDate,
  useAsyncData,
} from './coach/_shared';
import { inviteErrorMessage, useAcceptInvite } from './coach/useAcceptInvite';

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
  const { busy, accept } = useAcceptInvite();
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

  // Manual code entry. Shares one accept path with JoinPage via useAcceptInvite.
  const connect = async () => {
    if (!code.trim()) return;
    const res = await accept(code);
    if (res.ok) {
      setCode('');
      reload();
      showToast('התחברת למאמן', 'success');
    } else {
      showToast(inviteErrorMessage(res.error), 'error');
    }
  };

  return (
    <CoachPage title="המאמן שלי" subtitle="My Coach" onBack={() => navigate('/')}>
      <Section title="חיבור למאמן">
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void connect();
                }
              }}
              placeholder="קוד הזמנה"
              dir="ltr"
              aria-label="קוד הזמנה"
              style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.12em' }}
            />
          </div>
          <Button variant="primary" isLoading={busy} disabled={!code.trim()} onClick={connect}>
            התחבר
          </Button>
        </div>
      </Section>

      <Section title="המאמנים שלי">
        {coachesLoading ? (
          <ListSkeleton rows={2} />
        ) : coaches.length === 0 ? (
          <EmptyState
            illustration="generic"
            title="עדיין לא התחברת למאמן"
            description="הזן קוד הזמנה למעלה כדי להתחבר למאמן."
          />
        ) : (
          coaches.map((c) => (
            <ListRow
              key={c.id}
              label={c.coachProfile?.displayName ?? 'מאמן'}
              meta={`מחובר מאז ${formatDate(c.consentAt ?? c.createdAt)}`}
              trailing={
                <div className="flex gap-2 items-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="שלח הודעה למאמן"
                    onClick={() => navigate(`/my-coach/messages/${c.coachId}`)}
                    className="shrink-0"
                  >
                    <MessageSquare size={15} aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    style={{ color: 'var(--fs-muted)' }}
                    onClick={async () => {
                      await disconnectCoach(c.id);
                      reload();
                      showToast('המאמן נותק', 'success');
                    }}
                  >
                    נתק
                  </Button>
                </div>
              }
            />
          ))
        )}
      </Section>

      <CheckInForm />

      <Section title="היסטוריית שיוכים">
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--fs-muted)',
            lineHeight: 1.6,
            marginBottom: 12,
          }}
        >
          תוכניות האימון מופיעות במסך האימון, ויעדי התזונה במסך התזונה. כאן מרוכזת היסטוריית כל מה
          שהמאמן שלח אליך.
        </p>
        {aLoading ? (
          <ListSkeleton rows={3} />
        ) : assignments.length === 0 ? (
          <EmptyState
            illustration="notes"
            title="אין המלצות או שיוכים עדיין"
            description="כשהמאמן ישלח תוכנית או המלצה, היא תופיע כאן."
          />
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
      <div className="mb-3">
        <Input
          type="number"
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder='משקל (ק"ג)'
          aria-label="משקל"
          unit='ק"ג'
        />
      </div>
      {/* Mood: 5 buttons, each ≥44×44 (flex-1 row keeps them tappable + aligned). */}
      <div className="flex gap-2 mb-3" role="group" aria-label="מצב רוח">
        {[1, 2, 3, 4, 5].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMood(m)}
            aria-label={`מצב רוח ${m}`}
            aria-pressed={mood === m}
            className="flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-0"
            style={{
              minWidth: 44,
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
      <div className="mb-2">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="איך עבר השבוע?"
          aria-label="הערות צ׳ק-אין"
        />
      </div>
      <Button variant="primary" fullWidth isLoading={busy} onClick={submit}>
        שמור צ׳ק-אין
      </Button>
    </Section>
  );
}
