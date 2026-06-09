// ============================================================================
// COACH HOME — the coach's command center (their "/" home screen).
// Attention triage, quick links, aggregate overview. The full searchable
// roster lives on /coach/clients (CoachClients).
// ============================================================================

import {
  Check,
  ChevronLeft,
  Dumbbell,
  LineChart,
  MessageSquare,
  UserPlus,
  Users,
} from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FadeIn } from '../../components/motion/FadeIn';
import { Button } from '../../components/ui/Button';
import { useCoach } from '../../contexts/CoachContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import {
  type ClientOverviewRow,
  type TodayScheduleCount,
  getClientsOverview,
  getSeatUsage,
  listClients,
  summarizeRoster,
} from '../../services/coach';
import { triggerHapticIntensity } from '../../utils/haptics';
import { CoachPage, ListSkeleton, Section, SectionError, useAsyncData } from './_shared';
import {
  AttentionRow,
  OverviewStat,
  QuickLink,
  RowSignalChips,
  useRosterSignals,
} from './rosterPrimitives';

export default function CoachHome() {
  const navigate = useNavigate();
  const { coachProfile, loading: coachLoading } = useCoach();
  const {
    data: rows,
    loading,
    error,
    reload,
  } = useAsyncData<ClientOverviewRow[]>(
    () => listClients('active').then((clients) => getClientsOverview(clients)),
    []
  );
  const { data: seats } = useAsyncData(() => getSeatUsage(), { used: 0, limit: 0, full: false });
  const unread = useUnreadMessages();
  const summary = useMemo(() => summarizeRoster(rows), [rows]);

  // Command-center signals: unread-per-client, recent check-ins, today's plan.
  // ONE batched fetch per source via the shared hook (no N+1); while loading,
  // the schedule-dependent overview stats render a placeholder (not a hard 0)
  // and the per-row chips stay hidden so the page never flashes "0 planned".
  const clientIds = useMemo(() => rows.map((r) => r.client.clientId), [rows]);
  const { signals, signalsLoading } = useRosterSignals(clientIds);

  // Top-3 at_risk/inactive rows — already attention-sorted by getClientsOverview.
  const attentionRows = useMemo(
    () =>
      rows
        .filter((r) => r.analytics.level === 'at_risk' || r.analytics.level === 'inactive')
        .slice(0, 3),
    [rows]
  );

  // "Planned for today" = full scheduled-today denominator (still-planned OR
  // already-done), so "כבר התאמנו" reads as a subset of it (a progress pair)
  // instead of the two counts contradicting once everyone finishes.
  const dueToday = useMemo(
    () => Object.values(signals.scheduledToday).filter((c) => c.planned > 0 || c.done > 0).length,
    [signals.scheduledToday]
  );
  const trainedToday = useMemo(
    () => Object.values(signals.scheduledToday).filter((c) => c.done > 0).length,
    [signals.scheduledToday]
  );

  // Celebration haptic: fire ONCE when any attention row has trained today,
  // instead of one buzz per WinChip on passive render (which felt like a stutter).
  const anyAttentionTrained = useMemo(
    () =>
      !signalsLoading &&
      attentionRows.some((r) => (signals.scheduledToday[r.client.clientId]?.done ?? 0) > 0),
    [signalsLoading, attentionRows, signals.scheduledToday]
  );
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (anyAttentionTrained && !reducedMotion) triggerHapticIntensity('light');
  }, [anyAttentionTrained, reducedMotion]);

  // Hide the seat subtitle until it is meaningful — avoids a "0/0 מושבים" flash
  // before getSeatUsage resolves; the digits render LTR inside the RTL header.
  const seatSubtitle =
    seats.limit > 0 ? (
      <>
        <bdi dir="ltr">
          {seats.used}/{seats.limit}
        </bdi>{' '}
        מושבים
      </>
    ) : undefined;

  if (coachLoading) {
    return (
      <CoachPage title="מרכז המאמן" subtitle="Coaching" hideBack>
        <ListSkeleton rows={4} />
      </CoachPage>
    );
  }

  return (
    <CoachPage
      title={coachProfile?.businessName || 'מרכז המאמן'}
      subtitle={seatSubtitle}
      hideBack
      actions={
        <Button
          variant="primary"
          size="icon"
          aria-label="הזמנת מתאמן"
          onClick={() => navigate('/coach/invites')}
          className="shrink-0"
          style={{ background: 'var(--fs-primary)', color: 'var(--fs-accent)' }}
        >
          <UserPlus size={18} aria-hidden="true" />
        </Button>
      }
    >
      {/* Quick links */}
      <Section>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <QuickLink
            icon={<UserPlus size={18} />}
            label="הזמנות"
            onClick={() => navigate('/coach/invites')}
          />
          <QuickLink
            icon={<Users size={18} />}
            label="קבוצות"
            onClick={() => navigate('/coach/groups')}
          />
          <QuickLink
            icon={<MessageSquare size={18} />}
            label="הודעות"
            onClick={() => navigate('/coach/messages')}
            badge={unread}
          />
        </div>
      </Section>

      {loading ? (
        <Section title="דורשים טיפול היום">
          <ListSkeleton rows={3} />
        </Section>
      ) : error ? (
        <Section title="דורשים טיפול היום">
          <SectionError onRetry={reload} />
        </Section>
      ) : rows.length === 0 ? (
        <CoachEmptyState onInvite={() => navigate('/coach/invites')} />
      ) : (
        <>
          {/* דורשים טיפול היום */}
          <Section title="דורשים טיפול היום">
            {attentionRows.length === 0 ? (
              <AllActiveState />
            ) : (
              attentionRows.map((row) => (
                <AttentionRowWithSignals
                  key={row.client.id}
                  row={row}
                  unread={signals.unreadByClient[row.client.clientId] ?? 0}
                  hasRecentCheckIn={signals.recentCheckIns.has(row.client.clientId)}
                  today={signals.scheduledToday[row.client.clientId]}
                  signalsLoading={signalsLoading}
                  onOpenClient={() => navigate(`/coach/clients/${row.client.clientId}`)}
                  onMessage={() => navigate(`/coach/messages/${row.client.clientId}`)}
                />
              ))
            )}
          </Section>

          {/* Aggregate overview */}
          <Section title="סקירה כללית">
            <div className="grid grid-cols-3 gap-2">
              <OverviewStat
                label="מתוכננים להיום"
                value={dueToday}
                color="var(--fs-accent)"
                indicator="due"
                loading={signalsLoading}
              />
              <OverviewStat
                label="כבר התאמנו"
                value={trainedToday}
                color="var(--fs-accent)"
                indicator="trained"
                loading={signalsLoading}
              />
              <OverviewStat
                label="דורשים תשומת לב"
                value={summary.needsAttention}
                color="var(--fs-warn)"
              />
            </div>
          </Section>

          {/* Jump to the full roster */}
          <Section>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => navigate('/coach/clients')}
              aria-label="לכל המתאמנים"
            >
              <span className="inline-flex items-center gap-2">
                כל המתאמנים
                <ChevronLeft size={16} aria-hidden="true" />
              </span>
            </Button>
          </Section>
        </>
      )}
    </CoachPage>
  );
}

// ── Coach empty state ──────────────────────────────────────────────────────────
// A composed "ראשית" (getting-started) lockup for a coach with zero clients:
// three numbered steps that show HOW the platform works, then a prominent
// invite CTA. Replaces the generic EmptyState so the first-run screen guides
// instead of just stating emptiness. FadeIn honors prefers-reduced-motion.

const ONBOARD_STEPS: readonly { icon: React.ReactNode; title: string; body: string }[] = [
  {
    icon: <UserPlus size={18} aria-hidden="true" />,
    title: 'הזמינו מתאמן',
    body: 'שלחו קוד הזמנה — ההצטרפות לוקחת פחות מדקה.',
  },
  {
    icon: <Dumbbell size={18} aria-hidden="true" />,
    title: 'בנו תוכנית',
    body: 'הרכיבו תוכנית אימון או יעד תזונה ושייכו אותם למתאמן.',
  },
  {
    icon: <LineChart size={18} aria-hidden="true" />,
    title: 'עקבו אחר ההתקדמות',
    body: 'צ׳ק-אינים, אימונים ומדדים מתעדכנים אצלכם בזמן אמת.',
  },
];

function CoachEmptyState({ onInvite }: { onInvite: () => void }) {
  return (
    <Section>
      <FadeIn>
        <div
          style={{
            padding: '20px 16px',
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-surface-2)',
            boxShadow: 'var(--shadow-card)',
            marginBottom: 12,
          }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: '-0.01em',
              color: 'var(--fs-heading)',
              margin: 0,
            }}
          >
            ראשית — שלושה צעדים
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--fs-muted)',
              lineHeight: 1.6,
              margin: '6px 0 18px',
            }}
          >
            עדיין אין מתאמנים מחוברים. כך מתחילים — בשלושה צעדים.
          </p>

          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 14 }}>
            {ONBOARD_STEPS.map((step, i) => (
              <li key={step.title} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  style={{
                    flexShrink: 0,
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--fs-primary)',
                    color: 'var(--fs-accent)',
                  }}
                >
                  {step.icon}
                </span>
                <div className="min-w-0">
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 6,
                      fontFamily: 'var(--font-body)',
                      fontSize: 15,
                      fontWeight: 700,
                      color: 'var(--fs-ink)',
                    }}
                  >
                    <span
                      dir="ltr"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--fs-muted)',
                      }}
                    >
                      {i + 1}
                    </span>
                    {step.title}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 13,
                      color: 'var(--fs-muted)',
                      lineHeight: 1.55,
                      marginTop: 2,
                    }}
                  >
                    {step.body}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </FadeIn>

      <Button
        variant="primary"
        fullWidth
        icon={<UserPlus size={18} aria-hidden="true" />}
        onClick={onInvite}
        style={{ minHeight: 48 }}
      >
        הזמנת מתאמן
      </Button>
    </Section>
  );
}

// ── All-active state ────────────────────────────────────────────────────────────
// Shown when no client needs attention. A SOFT, NON-blinking affirmation — a
// calm accent-tinted disc + check, not an animated "live" dot. Honors
// prefers-reduced-motion via the FadeIn primitive (renders instantly when set).
function AllActiveState() {
  return (
    <FadeIn
      className="flex items-center gap-3"
      style={{
        padding: '14px 16px',
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: 999,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'color-mix(in srgb, var(--fs-accent) 16%, transparent)',
          color: 'var(--fs-accent)',
        }}
      >
        <Check size={18} strokeWidth={3} />
      </span>
      <div className="min-w-0">
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--fs-ink)',
          }}
        >
          כל המתאמנים על המסלול
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--fs-muted)',
            marginTop: 2,
          }}
        >
          אין מי שדורש טיפול כרגע
        </div>
      </div>
    </FadeIn>
  );
}

// ── AttentionRow + signals wrapper ─────────────────────────────────────────────
// Renders the chips in a thin local wrapper around rosterPrimitives.AttentionRow
// (which this screen does not own) so we never nest interactive elements.

function AttentionRowWithSignals({
  row,
  unread,
  hasRecentCheckIn,
  today,
  signalsLoading,
  onOpenClient,
  onMessage,
}: {
  row: ClientOverviewRow;
  unread: number;
  hasRecentCheckIn: boolean;
  today?: TodayScheduleCount;
  signalsLoading: boolean;
  onOpenClient: () => void;
  onMessage: () => void;
}) {
  return (
    <div>
      {!signalsLoading && (
        <RowSignalChips unread={unread} hasRecentCheckIn={hasRecentCheckIn} today={today} />
      )}
      <AttentionRow row={row} onOpenClient={onOpenClient} onMessage={onMessage} />
    </div>
  );
}
