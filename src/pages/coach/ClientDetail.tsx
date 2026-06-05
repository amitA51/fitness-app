// ============================================================================
// CLIENT DETAIL — coach view of one trainee (read) + assign actions
// ============================================================================

import { Archive, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../components/ui/GlobalToast';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/Textarea';
import {
  addCoachNote,
  archiveAssignment,
  clientStatusMeta,
  createAssignment,
  getClientAnalytics,
  getClientBodyWeight,
  getClientLink,
  getClientMeasurements,
  getClientNutrition,
  getClientPRs,
  getClientSessions,
  listCheckIns,
  listCoachAssignments,
  listCoachNotes,
  setClientStatus,
} from '../../services/coach';
import type { Assignment } from '../../types/coach';
import ProgramBuilder from './ProgramBuilder';
import {
  CoachPage,
  InlineEmpty,
  ListRow,
  ListSkeleton,
  Section,
  SectionError,
  formatDate,
  useAsyncData,
} from './_shared';

const KIND_LABEL: Record<Assignment['kind'], string> = {
  program: 'תוכנית אימון',
  nutrition_target: 'יעד תזונה',
  note: 'המלצה',
  announcement: 'הודעה',
};

// Trainee link status → Hebrew (never surface the raw English enum to the coach).
const STATUS_LABEL: Record<string, string> = {
  pending: 'ממתין',
  active: 'פעיל',
  paused: 'מושהה',
  ended: 'הסתיים',
};

export default function ClientDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [builderOpen, setBuilderOpen] = useState(false);

  const { data: link } = useAsyncData(() => getClientLink(id), null);
  const { data: analytics } = useAsyncData(() => getClientAnalytics(id), null);
  const { data: sessions, loading } = useAsyncData(() => getClientSessions(id, 10), []);
  const { data: weights } = useAsyncData(() => getClientBodyWeight(id), []);
  const { data: measurements } = useAsyncData(() => getClientMeasurements(id), []);
  const { data: prs } = useAsyncData(() => getClientPRs(id), []);
  const { data: nutrition } = useAsyncData(() => getClientNutrition(id, 7), []);
  const { data: checkIns } = useAsyncData(() => listCheckIns(id), []);

  const name = link?.clientProfile?.displayName ?? 'מתאמן';
  const latestWeight = weights[0]?.weight;

  return (
    <CoachPage
      title={name}
      subtitle={link ? `מצב: ${STATUS_LABEL[link.status] ?? link.status}` : 'מתאמן'}
      actions={
        <Button
          variant="primary"
          size="icon"
          aria-label="שלח הודעה למתאמן"
          onClick={() => navigate(`/coach/messages/${id}`)}
          className="shrink-0"
          style={{ background: 'var(--fs-primary)', color: 'var(--fs-accent)' }}
        >
          <MessageSquare size={18} aria-hidden="true" />
        </Button>
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

      {analytics && (
        <Section title="היענות לתוכנית">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="אימונים השבוע" value={String(analytics.sessionsLast7)} />
            <Stat
              label="לעומת שבוע שעבר"
              value={adherenceDelta(analytics.sessionsLast7, analytics.sessionsPrev7)}
              color={
                analytics.sessionsLast7 >= analytics.sessionsPrev7
                  ? 'var(--fs-accent)'
                  : 'var(--fs-warn)'
              }
            />
          </div>
        </Section>
      )}

      <AssignBox clientId={id} />

      <AssignmentsBox clientId={id} />

      <Section title="תוכנית אימון">
        <Button variant="primary" fullWidth onClick={() => setBuilderOpen(true)}>
          בנה תוכנית
        </Button>
      </Section>
      <ProgramBuilder clientId={id} isOpen={builderOpen} onClose={() => setBuilderOpen(false)} />

      <Section title="אימונים אחרונים">
        {loading ? (
          <ListSkeleton rows={3} />
        ) : sessions.length === 0 ? (
          <InlineEmpty>אין אימונים מתועדים.</InlineEmpty>
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
          <InlineEmpty>אין יומני תזונה.</InlineEmpty>
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
          <InlineEmpty>אין שיאים.</InlineEmpty>
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

      <Section title="מדדי גוף">
        {measurements.length === 0 ? (
          <InlineEmpty>אין מדידות גוף.</InlineEmpty>
        ) : (
          measurements
            .slice(0, 8)
            .map((m) => (
              <ListRow
                key={m.id}
                label={formatDate(m.date)}
                meta={formatMeasurements(m.measurements)}
              />
            ))
        )}
      </Section>

      <Section title="צ׳ק-אינים">
        {checkIns.length === 0 ? (
          <InlineEmpty>אין צ׳ק-אינים.</InlineEmpty>
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
          fontVariantNumeric: 'tabular-nums',
          color: color ?? 'var(--fs-heading)',
        }}
      >
        {value}
      </div>
    </div>
  );
}

/** Signed week-over-week session delta for the adherence card. */
function adherenceDelta(last7: number, prev7: number): string {
  const diff = last7 - prev7;
  if (diff === 0) return 'ללא שינוי';
  return diff > 0 ? `+${diff}` : String(diff);
}

/** Compact summary of a body-measurement record's numeric fields. */
function formatMeasurements(measurements: Record<string, unknown>): string {
  const parts = Object.entries(measurements)
    .filter(([, v]) => typeof v === 'number' && Number.isFinite(v))
    .map(([k, v]) => `${k} ${v}`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

/**
 * Sent recommendations/assignments authored by this coach for this client,
 * with the ability to REVOKE (archive) one — wires archiveAssignment, which
 * previously had no caller.
 */
function AssignmentsBox({ clientId }: { clientId: string }) {
  const {
    data: assignments,
    loading,
    error,
    reload,
  } = useAsyncData<Assignment[]>(() => listCoachAssignments(clientId), []);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const active = assignments.filter((a) => a.status === 'active');

  const revoke = async (id: string) => {
    setRevokingId(id);
    const { error } = await archiveAssignment(id);
    setRevokingId(null);
    if (error) {
      showToast('ביטול השיוך נכשל', 'error');
      return;
    }
    showToast('השיוך בוטל', 'success');
    reload();
  };

  return (
    <Section title="שיוכים פעילים">
      {loading ? (
        <ListSkeleton rows={3} />
      ) : error ? (
        <SectionError onRetry={reload} />
      ) : active.length === 0 ? (
        <InlineEmpty>לא נשלחו שיוכים פעילים.</InlineEmpty>
      ) : (
        active.map((a) => (
          <ListRow
            key={a.id}
            label={a.title || KIND_LABEL[a.kind]}
            meta={`${KIND_LABEL[a.kind]} · ${formatDate(a.createdAt)}`}
            trailing={
              <Button
                variant="secondary"
                size="sm"
                icon={<Archive size={14} />}
                isLoading={revokingId === a.id}
                onClick={() => revoke(a.id)}
              >
                בטל
              </Button>
            }
          />
        ))
      )}
    </Section>
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
      <div className="mb-2">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="כתוב המלצה למתאמן…"
          rows={2}
          aria-label="המלצה למתאמן"
        />
      </div>
      <Button variant="primary" fullWidth isLoading={busy} onClick={sendNote}>
        שלח המלצה
      </Button>
      <div className="flex gap-2 mt-3 items-end">
        <div className="flex-1">
          <Input
            type="number"
            inputMode="numeric"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
            placeholder="יעד קלוריות"
            aria-label="יעד קלוריות"
          />
        </div>
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
      <div className="mb-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="הערה פרטית (רק אתה רואה)…"
          aria-label="הערה פרטית"
        />
      </div>
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
