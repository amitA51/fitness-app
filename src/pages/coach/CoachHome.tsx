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
import { m } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FadeIn } from '../../components/motion/FadeIn';
import { Button } from '../../components/ui/Button';
import { useCoach } from '../../contexts/CoachContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import { triggerHapticIntensity } from '../../utils/haptics';
import {
  type ClientOverviewRow,
  type TodayScheduleCount,
  getClientsOverview,
  getRecentCheckInFlags,
  getScheduledTodayByClient,
  getSeatUsage,
  getUnreadCountByClient,
  listClients,
  summarizeRoster,
} from '../../services/coach';
import { CoachPage, ListSkeleton, Section, SectionError, useAsyncData } from './_shared';
import { AttentionRow, OverviewStat, QuickLink } from './rosterPrimitives';

/** Command-center signals fetched once the roster resolves (best-effort). */
interface RosterSignals {
  unreadByClient: Record<string, number>;
  recentCheckIns: Set<string>;
  scheduledToday: Record<string, TodayScheduleCount>;
}

const EMPTY_SIGNALS: RosterSignals = {
  unreadByClient: {},
  recentCheckIns: new Set(),
  scheduledToday: {},
};

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

  // Stable join key of the active client ids — drives the signals fetch below.
  const clientIds = useMemo(() => rows.map((r) => r.client.clientId), [rows]);
  const clientIdsKey = clientIds.join(',');

  // Command-center signals: unread-per-client, recent check-ins, today's plan.
  // Best-effort — each source degrades to empty on failure without breaking the
  // page. One batched query per source (no N+1).
  const [signals, setSignals] = useState<RosterSignals>(EMPTY_SIGNALS);
  useEffect(() => {
    if (clientIds.length === 0) {
      setSignals(EMPTY_SIGNALS);
      return;
    }
    let cancelled = false;
    void Promise.allSettled([
      getUnreadCountByClient(),
      getRecentCheckInFlags(clientIds),
      getScheduledTodayByClient(clientIds),
    ]).then(([unreadRes, checkInRes, scheduleRes]) => {
      if (cancelled) return;
      setSignals({
        unreadByClient: unreadRes.status === 'fulfilled' ? unreadRes.value : {},
        recentCheckIns: checkInRes.status === 'fulfilled' ? checkInRes.value : new Set(),
        scheduledToday: scheduleRes.status === 'fulfilled' ? scheduleRes.value : {},
      });
    });
    return () => {
      cancelled = true;
    };
    // clientIdsKey is the stable identity of clientIds; re-running on the array
    // ref itself would refetch every render.
    // biome-ignore lint/correctness/useExhaustiveDependencies: clientIdsKey is the serialized identity of clientIds
  }, [clientIdsKey]);

  // Top-3 at_risk/inactive rows — already attention-sorted by getClientsOverview.
  const attentionRows = useMemo(
    () =>
      rows
        .filter((r) => r.analytics.level === 'at_risk' || r.analytics.level === 'inactive')
        .slice(0, 3),
    [rows]
  );

  // "Supposed to train today" = clients with at least one still-planned workout.
  const dueToday = useMemo(
    () => Object.values(signals.scheduledToday).filter((c) => c.planned > 0).length,
    [signals.scheduledToday]
  );
  const trainedToday = useMemo(
    () => Object.values(signals.scheduledToday).filter((c) => c.done > 0).length,
    [signals.scheduledToday]
  );

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
      subtitle={`${seats.used}/${seats.limit} מושבים`}
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
                label="אמורים להתאמן היום"
                value={dueToday}
                color="var(--fs-accent)"
                indicator="due"
              />
              <OverviewStat
                label="כבר התאמנו"
                value={trainedToday}
                color="var(--fs-accent)"
                indicator="trained"
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
            עדיין אין מתאמנים מחוברים. כך מתחילים לנהל את המאמנת או המאמן שבכם.
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

// ── Signal chips ──────────────────────────────────────────────────────────────
// Non-interactive <span> badges rendered ABOVE the AttentionRow so they never
// nest inside the row's action buttons. Token-only; numbers stay dir="ltr".

function SignalChip({
  label,
  color,
  background,
}: {
  label: string;
  color: string;
  background: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.04em',
        color,
        background,
        border: `1px solid ${color}`,
        borderRadius: 999,
        padding: '2px 8px',
        lineHeight: 1.4,
      }}
    >
      {label}
    </span>
  );
}

// ── Win chip ───────────────────────────────────────────────────────────────────
// A trained-today WIN is a legit celebration: the chip goes --fs-signal (lime),
// the check icon scale-pops once on appear, and a light haptic fires on mobile.
// prefers-reduced-motion: no pop, no entrance — the lime chip still renders.
function WinChip({ label }: { label: string }) {
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    triggerHapticIntensity('light');
  }, [reduced]);

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: 'var(--fs-signal)',
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-signal)',
        borderRadius: 999,
        padding: '2px 8px',
        lineHeight: 1.4,
      }}
    >
      {reduced ? (
        <Check size={11} strokeWidth={3} aria-hidden="true" />
      ) : (
        <m.span
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 520, damping: 16 }}
          style={{ display: 'inline-flex' }}
        >
          <Check size={11} strokeWidth={3} aria-hidden="true" />
        </m.span>
      )}
      {label}
    </span>
  );
}

function RowSignalChips({
  unread,
  hasRecentCheckIn,
  today,
}: {
  unread: number;
  hasRecentCheckIn: boolean;
  today?: TodayScheduleCount;
}) {
  const trainedToday = (today?.done ?? 0) > 0;
  const dueToday = (today?.planned ?? 0) > 0;
  const hasAny = hasRecentCheckIn || unread > 0 || trainedToday || dueToday;
  if (!hasAny) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      style={{ padding: '0 16px', marginBottom: 6 }}
    >
      {hasRecentCheckIn && (
        <SignalChip label="צ׳ק-אין חדש" color="var(--fs-accent)" background="var(--fs-surface)" />
      )}
      {unread > 0 && (
        <span
          aria-label={`${unread} הודעות שלא נקראו`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: 'var(--fs-accent)',
            background: 'var(--fs-primary)',
            borderRadius: 999,
            padding: '2px 8px',
            lineHeight: 1.4,
          }}
        >
          <MessageSquare size={11} aria-hidden="true" />
          <span dir="ltr">{unread}</span>
        </span>
      )}
      {trainedToday ? (
        <WinChip label="התאמן" />
      ) : dueToday ? (
        <SignalChip label="מתאמן היום" color="var(--fs-muted)" background="var(--fs-surface)" />
      ) : null}
    </div>
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
  onOpenClient,
  onMessage,
}: {
  row: ClientOverviewRow;
  unread: number;
  hasRecentCheckIn: boolean;
  today?: TodayScheduleCount;
  onOpenClient: () => void;
  onMessage: () => void;
}) {
  return (
    <div>
      <RowSignalChips unread={unread} hasRecentCheckIn={hasRecentCheckIn} today={today} />
      <AttentionRow row={row} onOpenClient={onOpenClient} onMessage={onMessage} />
    </div>
  );
}
