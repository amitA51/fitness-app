// ============================================================================
// MY COACH — trainee view: assignments inbox, coaches, consent management
// ============================================================================

import { Check, ImagePlus, MessageSquare, Play, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { VerdictLine, VerdictNumber } from '../components/insights/VerdictLine';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import { showToast } from '../components/ui/GlobalToast';
import { Input } from '../components/ui/Input';
import { Textarea } from '../components/ui/Textarea';
import { useAuth } from '../contexts/AuthContext';
import { syncTemplatesFromCloud } from '../hooks/useCloudTemplateReflection';
import {
  type ProgramDayRef,
  disconnectCoach,
  listCheckIns,
  listMyAssignments,
  listMyCoaches,
  resolveProgramDays,
  submitCheckIn,
  subscribeToAssignments,
  updateCheckInPhotos,
  uploadCheckInPhotos,
} from '../services/coach';
import { listGroupThreads } from '../services/coach/groupMessageService';
import type { Assignment, GroupThreadSummary } from '../types/coach';
import { getWeekStart, toLocalDateStr } from '../utils/dateUtils';
import {
  CoachPage,
  ListRow,
  ListSkeleton,
  Section,
  SectionError,
  formatDate,
  useAsyncData,
} from './coach/_shared';
import { inviteErrorMessage, useAcceptInvite } from './coach/useAcceptInvite';

const KIND_LABEL: Record<Assignment['kind'], string> = {
  program: 'תוכנית אימון',
  nutrition_target: 'יעד תזונה',
  note: 'המלצה',
  announcement: 'עדכון',
};

// Trailing-edge rail color, keyed by assignment kind. Reuses existing semantic
// tokens only — NEVER --fs-signal (reserved for PR/celebration) and NEVER a new
// hue. program=action accent, nutrition=warn, note/announcement=muted.
const KIND_RAIL: Record<Assignment['kind'], string> = {
  program: 'var(--fs-accent)',
  nutrition_target: 'var(--fs-warn)',
  note: 'var(--fs-muted)',
  announcement: 'var(--fs-muted)',
};

const ACK_STORAGE_KEY = 'mycoach:ackedAssignments';

/**
 * Local-only "handled" state for assignment cards. The trainee cannot write to
 * the coach-owned assignments row (RLS allows SELECT only), so a true server
 * status change is out of scope here — this persists a per-assignment
 * acknowledgement in localStorage so the trainee can mark items they've acted
 * on, surviving reloads without a backend dependency.
 */
function useLocalAck(): {
  isAcked: (id: string) => boolean;
  toggleAck: (id: string) => void;
} {
  const [acked, setAcked] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(ACK_STORAGE_KEY);
      return new Set(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });

  const persist = useCallback((next: Set<string>) => {
    try {
      localStorage.setItem(ACK_STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      // Storage unavailable (private mode / quota) — keep in-memory state only.
    }
  }, []);

  const toggleAck = useCallback(
    (id: string) => {
      setAcked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const isAcked = useCallback((id: string) => acked.has(id), [acked]);

  return { isAcked, toggleAck };
}

// Hash the bottom-nav "הודעות" entry appends when a trainee has multiple
// coaches — scroll the coaches list into view so they can pick a thread.
const COACHES_LIST_ANCHOR = 'coaches';

export default function MyCoach() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const coachesAnchorRef = useRef<HTMLDivElement>(null);
  const {
    data: coaches,
    loading: coachesLoading,
    error: coachesError,
    reload,
  } = useAsyncData(() => listMyCoaches('active'), []);
  const {
    data: assignments,
    loading: aLoading,
    error: assignmentsError,
    reload: reloadAssignments,
  } = useAsyncData(() => listMyAssignments(), []);
  const {
    data: groups,
    loading: groupsLoading,
    error: groupsError,
    reload: reloadGroups,
  } = useAsyncData<GroupThreadSummary[]>(() => listGroupThreads('member'), []);
  const [code, setCode] = useState('');
  const { busy, accept } = useAcceptInvite();
  const [startingId, setStartingId] = useState<string | null>(null);
  const [disconnectId, setDisconnectId] = useState<string | null>(null);
  const { isAcked, toggleAck } = useLocalAck();

  // coachId → display name, for stamping the sending coach on each card.
  const coachNameById = new Map(
    coaches.map((c) => [c.coachId, c.coachProfile?.displayName ?? 'מאמן'])
  );

  // Live inbox: reflect coach actions (program/note/announcement) the moment they land.
  useEffect(() => {
    if (!user?.id) return;
    return subscribeToAssignments(user.id, reloadAssignments);
  }, [user?.id, reloadAssignments]);

  // Deep-linked from the bottom-nav chat entry (#coaches): once the coaches list
  // has rendered, bring it into view so the trainee can pick a thread. Honors
  // reduced-motion via the smooth/auto split.
  useEffect(() => {
    if (location.hash !== `#${COACHES_LIST_ANCHOR}`) return;
    if (coachesLoading) return;
    const el = coachesAnchorRef.current;
    if (!el) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' });
  }, [location.hash, coachesLoading]);

  // Start a coach-assigned program: ensure the referenced template is synced
  // into the local-first store, then enter the existing ActiveWorkout flow.
  // When called with an explicit templateId (multi-day), that overrides a.templateId.
  const startProgram = async (a: Assignment, templateId?: string) => {
    const id = templateId ?? a.templateId;
    if (!id) return;
    setStartingId(a.id);
    try {
      await syncTemplatesFromCloud();
      navigate(`/workout/${id}`);
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
      // Neutral phrasing: re-entering a known code shouldn't falsely claim a NEW
      // connection (until the 'already' contract distinguishes the two).
      showToast('מחובר למאמן', 'success');
    } else {
      showToast(inviteErrorMessage(res.error), 'error');
    }
  };

  // Disconnect is irreversible — confirm, then check the returned {error} so a
  // failed unlink never shows a false 'נותק' success.
  const confirmDisconnect = async () => {
    if (!disconnectId) return;
    const { error } = await disconnectCoach(disconnectId);
    setDisconnectId(null);
    if (error) {
      showToast('הניתוק נכשל', 'error');
      return;
    }
    reload();
    showToast('המאמן נותק', 'success');
  };

  const isConnected = coaches.length > 0;

  // Connect-a-coach is the hero for a trainee with NO coach yet; once connected
  // it's a rare "add another" action, so it drops to the bottom and the page
  // leads with the recurring surfaces (coaches, weekly check-in) instead.
  const connectSection = (
    <Section title={isConnected ? 'חיבור למאמן נוסף' : 'חיבור למאמן'}>
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            label="קוד הזמנה"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void connect();
              }
            }}
            placeholder="ABC123"
            dir="ltr"
            aria-label="קוד הזמנה"
            style={{ fontFamily: 'var(--font-mono)', letterSpacing: '-0.01em' }}
          />
        </div>
        <Button variant="primary" isLoading={busy} disabled={!code.trim()} onClick={connect}>
          התחבר
        </Button>
      </div>
    </Section>
  );

  return (
    <CoachPage
      title="המאמן שלי"
      onBack={() => {
        // Return to where the user came from (usually the screen that opened the
        // "עוד" sheet) by popping in-app history; fall back to home only on a
        // cold deep-link entry where there's nothing to pop.
        const idx = (window.history.state as { idx?: number } | null)?.idx;
        if (idx && idx > 0) navigate(-1);
        else navigate('/');
      }}
    >
      {/* New trainee: connect is the hero, up top. Connected: see bottom. */}
      {!isConnected && connectSection}

      {/* Additive status lead — for a connected trainee, a one-line "so what":
          did this week's check-in go in yet, framed against the active coach. It
          summarizes state that's already actionable in the form below, so a
          loading/error/no-coach case simply renders nothing (never a false
          status). user.id is the same id listMyCoaches filtered on. */}
      {isConnected && user?.id && (
        <CheckInStatusLead
          userId={user.id}
          coachName={coaches[0]?.coachProfile?.displayName ?? 'המאמן שלך'}
        />
      )}

      <div id={COACHES_LIST_ANCHOR} ref={coachesAnchorRef} style={{ scrollMarginTop: 16 }}>
        <Section title="המאמנים שלי">
          {coachesLoading ? (
            <ListSkeleton rows={2} />
          ) : coachesError ? (
            <SectionError onRetry={reload} />
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
                      onClick={() => setDisconnectId(c.id)}
                    >
                      נתק
                    </Button>
                  </div>
                }
              />
            ))
          )}
        </Section>
      </div>

      {/* הקבוצות שלי — show only when groups exist; invisible to non-grouped trainees */}
      {groupsLoading && coaches.length > 0 ? (
        <Section title="הקבוצות שלי">
          <ListSkeleton rows={2} />
        </Section>
      ) : groupsError && coaches.length > 0 ? (
        <Section title="הקבוצות שלי">
          <SectionError onRetry={reloadGroups} />
        </Section>
      ) : groups.length > 0 ? (
        <Section title="הקבוצות שלי">
          {groups.map((g) => (
            <ListRow
              key={g.groupId}
              label={g.name}
              metaNode={
                <div
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 12,
                    color: 'var(--fs-muted)',
                    marginTop: 2,
                    display: 'flex',
                    gap: 8,
                    alignItems: 'baseline',
                  }}
                >
                  {g.lastBody && (
                    <span
                      dir="auto"
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {g.lastBody.length > 60 ? `${g.lastBody.slice(0, 60)}…` : g.lastBody}
                    </span>
                  )}
                  <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {formatDate(g.lastAt)}
                  </span>
                </div>
              }
              trailing={
                g.unread > 0 ? (
                  <span
                    dir="ltr"
                    aria-label={`${g.unread} הודעות שלא נקראו`}
                    style={{
                      background: 'var(--fs-primary)',
                      color: 'var(--fs-accent)',
                      borderRadius: 999,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      fontWeight: 700,
                      padding: '2px 7px',
                      minWidth: 20,
                      textAlign: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {g.unread}
                  </span>
                ) : undefined
              }
              onClick={() => navigate(`/my-coach/groups/${g.groupId}/chat`)}
            />
          ))}
        </Section>
      ) : null}

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
        ) : assignmentsError ? (
          <SectionError onRetry={reloadAssignments} />
        ) : assignments.length === 0 ? (
          <EmptyState
            illustration="notes"
            title="אין המלצות או שיוכים עדיין"
            description="כשהמאמן ישלח תוכנית או המלצה, היא תופיע כאן."
          />
        ) : (
          assignments.map((a) => (
            <AssignmentCard
              key={a.id}
              assignment={a}
              coachName={coachNameById.get(a.coachId) ?? 'מאמן'}
              days={resolveProgramDays(a, user?.id ?? '')}
              starting={startingId === a.id}
              acked={isAcked(a.id)}
              onStart={(templateId) => startProgram(a, templateId)}
              onToggleAck={() => toggleAck(a.id)}
            />
          ))
        )}
      </Section>

      {/* Demoted "add another coach" — only once the trainee already has one. */}
      {isConnected && connectSection}

      <ConfirmDialog
        isOpen={disconnectId !== null}
        variant="danger"
        title="ניתוק המאמן"
        description="המאמן יאבד גישה לנתונים שלך. ניתן להתחבר שוב בעזרת קוד הזמנה חדש."
        confirmLabel="נתק"
        cancelLabel="חזרה"
        onConfirm={confirmDisconnect}
        onCancel={() => setDisconnectId(null)}
      />
    </CoachPage>
  );
}

// ── Assignment card ──────────────────────────────────────────────────────────
// A coach assignment rendered as a card: a trailing-edge (inline-end) accent
// rail color-coded by kind, the sending coach's name in mono, a prominent Play
// affordance for programs, and a local mark-complete toggle. The rail sits on
// the inline-END edge so it lands correctly in the RTL layout.

interface AssignmentCardProps {
  assignment: Assignment;
  coachName: string;
  days: ProgramDayRef[];
  starting: boolean;
  acked: boolean;
  onStart: (templateId?: string) => void;
  onToggleAck: () => void;
}

function AssignmentCard({
  assignment: a,
  coachName,
  days,
  starting,
  acked,
  onStart,
  onToggleAck,
}: AssignmentCardProps) {
  const hasMultiDays = days.length > 0;
  const isProgram = a.kind === 'program';
  const title = a.title || KIND_LABEL[a.kind];

  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        boxShadow: 'var(--shadow-card)',
        padding: '14px 16px',
        // Leave room so content never sits under the rail (rail is on inline-end).
        paddingInlineEnd: 20,
        marginBottom: 8,
        opacity: acked ? 0.6 : 1,
        transition: 'opacity 150ms ease',
      }}
    >
      {/* Trailing-edge accent rail — inline-END edge, color-coded by kind. */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          insetInlineEnd: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: KIND_RAIL[a.kind],
        }}
      />

      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--fs-ink)',
              textDecoration: acked ? 'line-through' : 'none',
            }}
          >
            <bdi>{title}</bdi>
          </div>

          {/* kind + date in mono; coach name stamped in mono. */}
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--fs-muted)',
              marginTop: 3,
            }}
          >
            {KIND_LABEL[a.kind]} · {formatDate(a.createdAt)}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--fs-muted)',
              marginTop: 2,
            }}
          >
            מאת <bdi>{coachName}</bdi>
          </div>

          {/* Free-text note body for note/announcement kinds. */}
          {typeof a.payload.text === 'string' && a.payload.text.trim() !== '' && (
            <p
              dir="auto"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'var(--fs-ink)',
                lineHeight: 1.55,
                margin: '8px 0 0',
              }}
            >
              {a.payload.text}
            </p>
          )}

          {/* Macro line for nutrition targets. */}
          {a.kind === 'nutrition_target' && <MacroLine payload={a.payload} />}
        </div>

        {/* Mark-complete toggle (local acknowledgement). */}
        <button
          type="button"
          onClick={onToggleAck}
          aria-label={acked ? `בטל סימון "טופל" עבור ${title}` : `סמן את "${title}" כטופל`}
          aria-pressed={acked}
          className="shrink-0 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
          style={{
            width: 36,
            height: 36,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 999,
            cursor: 'pointer',
            background: acked ? 'var(--fs-primary)' : 'var(--fs-surface)',
            color: acked ? 'var(--fs-accent)' : 'var(--fs-muted)',
            border: `1px solid ${acked ? 'var(--fs-accent)' : 'var(--fs-surface-2)'}`,
          }}
        >
          <Check size={16} strokeWidth={acked ? 3 : 2} aria-hidden="true" />
        </button>
      </div>

      {/* Prominent Play affordance for programs. */}
      {isProgram &&
        (hasMultiDays ? (
          <div className="flex flex-col gap-1.5" style={{ marginTop: 12 }}>
            {days.map((day) => (
              <Button
                key={day.templateId}
                variant="primary"
                size="sm"
                fullWidth
                icon={<Play size={15} aria-hidden="true" />}
                isLoading={starting}
                onClick={() => onStart(day.templateId)}
                style={{ minHeight: 44, justifyContent: 'flex-start' }}
              >
                <bdi>{day.name}</bdi>
              </Button>
            ))}
          </div>
        ) : a.templateId ? (
          <Button
            variant="primary"
            fullWidth
            icon={<Play size={16} aria-hidden="true" />}
            isLoading={starting}
            onClick={() => onStart()}
            style={{ minHeight: 44, marginTop: 12 }}
          >
            התחל אימון
          </Button>
        ) : null)}
    </div>
  );
}

/** Compact macro meta line for nutrition_target cards (numbers stay LTR). */
function MacroLine({ payload }: { payload: Record<string, unknown> }) {
  const { calories, protein, carbs, fat } = payload;
  return (
    <span
      style={{
        display: 'block',
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        color: 'var(--fs-muted)',
        marginTop: 8,
      }}
    >
      {typeof calories === 'number' && (
        <>
          {'קלוריות: '}
          <span dir="ltr">{calories}</span>
        </>
      )}
      {typeof protein === 'number' && (
        <>
          {' · חלבון: '}
          <span dir="ltr">{protein}</span>
          {' גרם'}
        </>
      )}
      {typeof carbs === 'number' && (
        <>
          {' · פחמימות: '}
          <span dir="ltr">{carbs}</span>
          {' גרם'}
        </>
      )}
      {typeof fat === 'number' && (
        <>
          {' · שומן: '}
          <span dir="ltr">{fat}</span>
          {' גרם'}
        </>
      )}
    </span>
  );
}

// ── Weekly check-in status lead ──────────────────────────────────────────────
// An additive "so what" line at the top of the connected-trainee view: it states
// whether THIS week's check-in is already in, derived from the trainee's own
// check-in history (listCheckIns) compared against the current Sunday-start week.
// Copy is plain, gender-neutral plural Hebrew (the app's default voice — cf.
// "העלו עומס"); the driving count renders as a tinted LTR VerdictNumber. Tone is
// carried only by the number's zone, never lime. It NEVER fabricates a status:
// while loading or on error it renders nothing, leaving the check-in form below
// as the single source of truth.

interface CheckInStatusLeadProps {
  userId: string;
  coachName: string;
}

function CheckInStatusLead({ userId, coachName }: CheckInStatusLeadProps) {
  const { data: checkIns, loading, error } = useAsyncData(() => listCheckIns(userId), []);

  // Silent until we have real data — additive, never a false status above the page.
  if (loading || error) return null;

  // Current week boundary as a local YYYY-MM-DD string. CheckIn.date is also a
  // local YYYY-MM-DD, so a lexicographic compare is an exact, timezone-safe
  // "is this date in the current (Sunday-start) week?" test — no Date parsing.
  const weekStartStr = toLocalDateStr(getWeekStart(new Date()));
  const submittedThisWeek = checkIns.filter((c) => c.date >= weekStartStr).length;

  // State 1 — done this week: at least one check-in dated within the current week.
  if (submittedThisWeek > 0) {
    return (
      <VerdictLine kicker="צ׳ק-אין שבועי" className="mb-6">
        שלחתם השבוע <VerdictNumber value={submittedThisWeek} zone="good" />{' '}
        {submittedThisWeek === 1 ? 'צ׳ק-אין' : 'צ׳ק-אינים'} אל <bdi>{coachName}</bdi>. אפשר להוסיף
        עוד עדכון בכל רגע.
      </VerdictLine>
    );
  }

  // State 2 — has history but nothing this week: gentle nudge, attention zone.
  if (checkIns.length > 0) {
    return (
      <VerdictLine kicker="צ׳ק-אין שבועי" className="mb-6">
        עדיין לא שלחתם צ׳ק-אין השבוע. עדכנו את <bdi>{coachName}</bdi> כדי שהמעקב יישאר מדויק.
      </VerdictLine>
    );
  }

  // State 3 — no check-ins at all: first-time framing, neutral zone (no judgment).
  return (
    <VerdictLine kicker="צ׳ק-אין שבועי" className="mb-6">
      טרם שלחתם צ׳ק-אין. הצ׳ק-אין הראשון נותן ל<bdi>{coachName}</bdi> תמונת מצב להתאמת התוכנית.
    </VerdictLine>
  );
}

const MAX_CHECKIN_PHOTOS = 4;

/** A staged (not-yet-uploaded) photo: the source file plus its preview URL. */
interface StagedPhoto {
  file: File;
  url: string;
}

/** A 1–5 rating row (mood / energy) — five ≥44×44 single-select buttons.
 *  Module-level (not nested in CheckInForm) so typing in the form's inputs
 *  doesn't remount the buttons on every keystroke. */
function RatingSelector({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex gap-2 mb-3" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${label} ${n} מתוך 5`}
          aria-pressed={value === n}
          className="flex-1 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-0"
          style={{
            minWidth: 44,
            minHeight: 44,
            background: value === n ? 'var(--fs-primary)' : 'var(--fs-surface)',
            color: value === n ? 'var(--fs-accent)' : 'var(--fs-muted)',
            border: '1px solid var(--fs-surface-2)',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function CheckInForm() {
  const [weight, setWeight] = useState('');
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Mirror the latest staged set so the unmount cleanup revokes the real URLs
  // (a [] effect would otherwise capture the initial empty array and leak them).
  const photosRef = useRef(photos);
  photosRef.current = photos;

  // Revoke any outstanding object URLs on unmount to avoid leaking them.
  useEffect(() => {
    return () => {
      for (const p of photosRef.current) URL.revokeObjectURL(p.url);
    };
  }, []);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setPhotoError(null);
    const incoming = Array.from(fileList);
    const room = MAX_CHECKIN_PHOTOS - photos.length;
    if (room <= 0) {
      setPhotoError(`אפשר לצרף עד ${MAX_CHECKIN_PHOTOS} תמונות`);
      return;
    }
    const accepted = incoming.slice(0, room).map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    if (incoming.length > room) setPhotoError(`אפשר לצרף עד ${MAX_CHECKIN_PHOTOS} תמונות`);
    setPhotos((prev) => [...prev, ...accepted]);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== index);
    });
    setPhotoError(null);
  };

  const submit = async () => {
    setBusy(true);
    const { error, id } = await submitCheckIn({
      weight: weight ? Number(weight) : null,
      mood,
      energy,
      notes,
    });
    if (error) {
      setBusy(false);
      showToast('שמירת הצ׳ק-אין נכשלה', 'error');
      return;
    }

    // Upload photos AFTER the row exists (path needs its id). A per-photo
    // failure is surfaced inline but never blocks the saved check-in itself.
    if (id && photos.length > 0) {
      const { refs, errors } = await uploadCheckInPhotos(
        id,
        photos.map((p) => p.file)
      );
      if (refs.length > 0) {
        // Check the link result so uploaded blobs aren't silently orphaned from
        // the check-in row.
        const { error: linkErr } = await updateCheckInPhotos(id, refs);
        if (linkErr) setPhotoError('שמירת התמונות נכשלה');
      }
      if (errors.length > 0) setPhotoError('חלק מהתמונות לא הועלו');
    }

    setBusy(false);
    for (const p of photos) URL.revokeObjectURL(p.url);
    setWeight('');
    setMood(null);
    setEnergy(null);
    setNotes('');
    setPhotos([]);
    setPhotoError(null);
    showToast('הצ׳ק-אין נשמר', 'success');
  };

  return (
    <Section title="צ׳ק-אין שבועי">
      <div className="mb-3">
        <Input
          label="משקל"
          type="number"
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="0.0"
          aria-label="משקל"
          unit='ק"ג'
        />
      </div>
      {/* Mood + energy: two identical 1–5 selectors (see RatingSelector). */}
      <RatingSelector label="מצב רוח" value={mood} onChange={setMood} />
      <RatingSelector label="אנרגיה" value={energy} onChange={setEnergy} />
      <div className="mb-3">
        <Textarea
          label="הערות"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="איך עבר השבוע?"
          aria-label="הערות צ׳ק-אין"
        />
      </div>

      {/* תמונות התקדמות — file input visually replaced by a 44px+ labelled button */}
      <div className="mb-4">
        <span
          className="block mb-2"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '-0.01em',
            fontWeight: 600,
            color: 'var(--fs-muted)',
          }}
        >
          תמונות התקדמות
        </span>

        {/* The native input stays in the DOM (keyboard/SR reach it) but is hidden;
            the labelled button below triggers it. */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="sr-only"
          aria-label="הוספת תמונות התקדמות"
          onChange={(e) => {
            addFiles(e.target.files);
            // Allow re-picking the same file after a remove.
            e.target.value = '';
          }}
        />

        {photos.length > 0 && (
          <div className="grid grid-cols-4 gap-2 mb-2">
            {photos.map((p, i) => (
              <div
                key={p.url}
                className="relative"
                style={{
                  aspectRatio: '1 / 1',
                  background: 'var(--fs-surface-2)',
                  border: '1px solid var(--fs-surface-2)',
                }}
              >
                <img
                  src={p.url}
                  alt={`תמונת התקדמות ${i + 1}`}
                  className="w-full h-full"
                  style={{ objectFit: 'cover' }}
                />
                <button
                  type="button"
                  onClick={() => removePhoto(i)}
                  aria-label={`הסרת תמונה ${i + 1}`}
                  className="absolute active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
                  style={{
                    top: 2,
                    insetInlineEnd: 2,
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--fs-primary)',
                    color: 'var(--color-ink-on-dark)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        {photos.length < MAX_CHECKIN_PHOTOS && (
          <Button
            variant="secondary"
            fullWidth
            icon={<ImagePlus size={16} aria-hidden="true" />}
            onClick={() => fileInputRef.current?.click()}
            style={{ minHeight: 44 }}
          >
            הוספת תמונות התקדמות
          </Button>
        )}

        {/* Inline error BELOW the control — not a toast (field-level). */}
        {photoError && (
          <p
            role="alert"
            className="mt-2"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.04em',
              color: 'var(--fs-warn)',
            }}
          >
            {photoError}
          </p>
        )}

        <p
          className="mt-2"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: 'var(--fs-muted)',
            lineHeight: 1.5,
          }}
        >
          התמונות פרטיות — רק המאמן שלך יכול לצפות בהן. אפשר לצרף עד{' '}
          <span dir="ltr">{MAX_CHECKIN_PHOTOS}</span> תמונות.
        </p>
      </div>

      <Button variant="primary" fullWidth isLoading={busy} onClick={submit}>
        שמור צ׳ק-אין
      </Button>
    </Section>
  );
}
