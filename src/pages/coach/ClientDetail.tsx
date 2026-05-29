// ============================================================================
// CLIENT DETAIL — coach view of one trainee (read) + assign actions
// ============================================================================

import { MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../components/workout/components/ui/Toast';
import {
  addCoachNote,
  clientStatusMeta,
  createAssignment,
  getClientAnalytics,
  getClientBodyWeight,
  getClientLink,
  getClientNutrition,
  getClientPRs,
  getClientSessions,
  listCheckIns,
  listCoachNotes,
  setClientStatus,
} from '../../services/coach';
import ProgramBuilder from './ProgramBuilder';
import { CoachPage, EmptyHint, ListRow, Section, formatDate, useAsyncData } from './_shared';

export default function ClientDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [builderOpen, setBuilderOpen] = useState(false);

  const { data: link } = useAsyncData(() => getClientLink(id), null);
  const { data: analytics } = useAsyncData(() => getClientAnalytics(id), null);
  const { data: sessions, loading } = useAsyncData(() => getClientSessions(id, 10), []);
  const { data: weights } = useAsyncData(() => getClientBodyWeight(id), []);
  const { data: prs } = useAsyncData(() => getClientPRs(id), []);
  const { data: nutrition } = useAsyncData(() => getClientNutrition(id, 7), []);
  const { data: checkIns } = useAsyncData(() => listCheckIns(id), []);

  const name = link?.clientProfile?.displayName ?? 'מתאמן';
  const latestWeight = weights[0]?.weight;

  return (
    <CoachPage
      title={name}
      subtitle={link ? `מצב: ${link.status}` : 'מתאמן'}
      actions={
        <button
          type="button"
          aria-label="הודעה"
          onClick={() => navigate(`/coach/messages/${id}`)}
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
            background: 'var(--fs-primary)',
            color: 'var(--fs-accent)',
          }}
        >
          <MessageSquare size={18} aria-hidden="true" />
        </button>
      }
    >
      <Section title="תקציר">
        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="מצב"
            value={analytics ? clientStatusMeta(analytics.level).label : '—'}
            color={analytics ? clientStatusMeta(analytics.level).color : undefined}
          />
          <Stat
            label="אימונים (7 ימים)"
            value={analytics ? String(analytics.sessionsLast7) : '—'}
          />
          <Stat
            label="פעילות אחרונה"
            value={
              analytics?.daysSinceActivity != null
                ? analytics.daysSinceActivity === 0
                  ? 'היום'
                  : `לפני ${analytics.daysSinceActivity} ימים`
                : '—'
            }
          />
          <Stat label="משקל אחרון" value={latestWeight ? `${latestWeight} ק"ג` : '—'} />
        </div>
      </Section>

      {analytics && (
        <Section title="מגמת נפח · 4 שבועות">
          <div
            className="px-4 py-4"
            style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-surface-2)' }}
          >
            <VolumeTrend weeks={analytics.volumeByWeek} />
          </div>
        </Section>
      )}

      <AssignBox clientId={id} />

      <Section title="תוכנית אימון">
        <Button variant="primary" fullWidth onClick={() => setBuilderOpen(true)}>
          בנה תוכנית
        </Button>
      </Section>
      {builderOpen && <ProgramBuilder clientId={id} onClose={() => setBuilderOpen(false)} />}

      <Section title="אימונים אחרונים">
        {loading ? (
          <EmptyHint>טוען…</EmptyHint>
        ) : sessions.length === 0 ? (
          <EmptyHint>אין אימונים מתועדים.</EmptyHint>
        ) : (
          sessions.map((s) => (
            <ListRow
              key={s.id}
              label={s.notes || `אימון · ${formatDate(s.startTime)}`}
              meta={`${formatDate(s.startTime)} · ${Math.round(s.totalVolume)} ק"ג נפח · ${s.exercises.length} תרגילים`}
            />
          ))
        )}
      </Section>

      <Section title="תזונה (7 ימים)">
        {nutrition.length === 0 ? (
          <EmptyHint>אין יומני תזונה.</EmptyHint>
        ) : (
          nutrition.map((n) => (
            <ListRow
              key={n.id}
              label={formatDate(n.date)}
              meta={`${n.calories ?? 0} קל' · ${n.protein ?? 0}ח · ${n.carbs ?? 0}פ · ${n.fat ?? 0}ש`}
            />
          ))
        )}
      </Section>

      <Section title="שיאים אישיים">
        {prs.length === 0 ? (
          <EmptyHint>אין שיאים.</EmptyHint>
        ) : (
          prs
            .slice(0, 8)
            .map((pr) => (
              <ListRow
                key={pr.id}
                label={pr.exerciseName}
                meta={`${pr.weight} ק"ג × ${pr.reps} · ${formatDate(pr.date)}`}
              />
            ))
        )}
      </Section>

      <Section title="צ׳ק-אינים">
        {checkIns.length === 0 ? (
          <EmptyHint>אין צ׳ק-אינים.</EmptyHint>
        ) : (
          checkIns.map((ci) => (
            <ListRow
              key={ci.id}
              label={formatDate(ci.date)}
              meta={
                [
                  ci.weight != null ? `${ci.weight} ק"ג` : null,
                  ci.mood != null ? `מצב רוח ${ci.mood}/5` : null,
                  ci.notes || null,
                ]
                  .filter(Boolean)
                  .join(' · ') || '—'
              }
            />
          ))
        )}
      </Section>

      <NotesBox clientId={id} />

      {link && link.status === 'active' && (
        <Section title="ניהול">
          <Button
            variant="secondary"
            fullWidth
            onClick={async () => {
              await setClientStatus(link.id, 'paused');
              showToast('המתאמן הושהה', 'success');
              navigate('/coach');
            }}
          >
            השהה מתאמן
          </Button>
        </Section>
      )}
    </CoachPage>
  );
}

const WEEK_LABELS = ['לפני 3ש׳', 'לפני 2ש׳', 'שבוע שעבר', 'השבוע'];

function VolumeTrend({ weeks }: { weeks: number[] }) {
  const max = Math.max(1, ...weeks);
  return (
    <div className="flex items-end gap-2" style={{ height: 72 }}>
      {WEEK_LABELS.map((lbl, i) => (
        <div
          key={lbl}
          className="flex-1 flex flex-col items-center justify-end"
          style={{ height: '100%' }}
        >
          <div
            style={{
              width: '100%',
              height: `${Math.round(((weeks[i] ?? 0) / max) * 100)}%`,
              minHeight: 3,
              background: 'var(--fs-accent)',
            }}
            title={`${Math.round(weeks[i] ?? 0)} ק"ג`}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--fs-muted)',
              marginTop: 6,
              whiteSpace: 'nowrap',
            }}
          >
            {lbl}
          </span>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      className="px-4 py-3"
      style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-surface-2)' }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--fs-muted)',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 20,
          fontWeight: 700,
          color: color ?? 'var(--fs-heading)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function AssignBox({ clientId }: { clientId: string }) {
  const [note, setNote] = useState('');
  const [calories, setCalories] = useState('');
  const [busy, setBusy] = useState(false);

  const sendNote = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await createAssignment({
        kind: 'note',
        title: 'המלצה',
        payload: { text: note.trim() },
        clientId,
      });
      setNote('');
      showToast('ההמלצה נשלחה', 'success');
    } catch {
      showToast('השליחה נכשלה', 'error');
    } finally {
      setBusy(false);
    }
  };

  const sendTarget = async () => {
    const kcal = Number(calories);
    if (!kcal) return;
    setBusy(true);
    try {
      await createAssignment({
        kind: 'nutrition_target',
        title: 'יעד תזונה',
        payload: { calories: kcal },
        clientId,
      });
      setCalories('');
      showToast('יעד התזונה שויך', 'success');
    } catch {
      showToast('השליחה נכשלה', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="שיוך והמלצות">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="כתוב המלצה למתאמן…"
        rows={2}
        className="w-full mb-2 px-3 py-2"
        style={{
          background: 'var(--fs-surface)',
          border: '1px solid var(--fs-surface-2)',
          color: 'var(--fs-ink)',
          fontFamily: 'var(--font-body)',
          fontSize: 14,
        }}
      />
      <Button variant="primary" fullWidth isLoading={busy} onClick={sendNote}>
        שלח המלצה
      </Button>
      <div className="flex gap-2 mt-3">
        <input
          type="number"
          inputMode="numeric"
          value={calories}
          onChange={(e) => setCalories(e.target.value)}
          placeholder="יעד קלוריות"
          className="flex-1 px-3 py-2"
          style={{
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-surface-2)',
            color: 'var(--fs-ink)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
          }}
        />
        <Button variant="secondary" isLoading={busy} onClick={sendTarget}>
          שייך יעד
        </Button>
      </div>
    </Section>
  );
}

function NotesBox({ clientId }: { clientId: string }) {
  const { data: notes, reload } = useAsyncData(() => listCoachNotes(clientId), []);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!body.trim()) return;
    setBusy(true);
    const { error } = await addCoachNote(clientId, body);
    setBusy(false);
    if (error) {
      showToast('שמירת ההערה נכשלה', 'error');
      return;
    }
    setBody('');
    reload();
  };

  return (
    <Section title="הערות פרטיות">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        placeholder="הערה פרטית (רק אתה רואה)…"
        aria-label="הערה פרטית"
        className="w-full mb-2 px-3 py-2"
        style={{
          background: 'var(--fs-surface)',
          border: '1px solid var(--fs-surface-2)',
          color: 'var(--fs-ink)',
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          resize: 'none',
        }}
      />
      <Button variant="secondary" fullWidth isLoading={busy} onClick={add}>
        הוסף הערה
      </Button>
      <div className="mt-2">
        {notes.map((n) => (
          <ListRow key={n.id} label={n.body} meta={formatDate(n.createdAt)} />
        ))}
      </div>
    </Section>
  );
}
