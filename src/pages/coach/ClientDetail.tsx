// ============================================================================
// CLIENT DETAIL — Fresh Steel / Obsidian design system
// Coach view of one trainee (read) + assign actions. Page orchestration only;
// sub-components live in ./client/.
// ============================================================================

import { MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../components/ui/GlobalToast';
import {
  clientStatusMeta,
  getClientAnalytics,
  getClientBodyWeight,
  getClientLink,
  getClientMeasurements,
  getClientNutrition,
  getClientPRs,
  getClientSessions,
  listCheckIns,
  listCoachAssignments,
  setClientStatus,
} from '../../services/coach';
import ProgramBuilder from './ProgramBuilder';
import {
  CoachPage,
  InlineEmpty,
  ListRow,
  ListSkeleton,
  Section,
  formatDate,
  useAsyncData,
} from './_shared';
import { AssignBox } from './client/AssignBox';
import { AssignmentsBox } from './client/AssignmentsBox';
import { AuditBox } from './client/AuditBox';
import { NotesBox } from './client/NotesBox';
import { RemindersBox } from './client/RemindersBox';
import { TimelineBox } from './client/TimelineBox';
import { WeekGrid } from './client/WeekGrid';
import { Stat, VolumeTrend } from './client/widgets';

// Trainee link status → Hebrew (never surface the raw English enum to the coach).
const STATUS_LABEL: Record<string, string> = {
  pending: 'ממתין',
  active: 'פעיל',
  paused: 'מושהה',
  ended: 'הסתיים',
};

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
  const { data: assignments } = useAsyncData(() => listCoachAssignments(id), []);

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

      <Section title="השבוע במבט-על">
        <WeekGrid clientId={id} />
      </Section>

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

      <Section title="ציר פעילות">
        <TimelineBox sessions={sessions} checkIns={checkIns} assignments={assignments} />
      </Section>

      <NotesBox clientId={id} />

      <AuditBox clientId={id} />

      {link && link.status === 'active' && <RemindersBox clientId={id} />}

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
