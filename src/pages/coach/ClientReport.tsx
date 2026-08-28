// ============================================================================
// CLIENT PROGRESS REPORT — printable 30-day summary (Fresh Steel / Obsidian)
// ============================================================================
// Coach-facing, print-optimized page: window.print() + the browser dialog is
// the "ייצוא PDF" path (perfect Hebrew RTL, zero new deps). On screen it uses
// the FS tokens; @media print forces white paper + ink text, hides the app
// chrome, and keeps each section on one page. Data comes from the existing
// coach readers (read-only); the coach-notes block is print-only ephemeral
// text and is intentionally NOT persisted.

import { ChevronRight, Printer, Share2 } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import {
  type DayAdherence,
  getClientBodyWeight,
  getClientLink,
  getClientNutrition,
  getClientPRs,
  getClientSessions,
  getClientWeekAdherence,
  getMyCoachProfile,
  listCoachAssignments,
} from '../../services/coach';
import type { NutritionLog, PersonalRecordRow } from '../../services/supabaseSyncMappers';
import type { BodyWeightEntry, WorkoutSession } from '../../types';
import { InlineEmpty, ListSkeleton, SectionError, formatDate, useAsyncData } from './_shared';
import {
  type ReportRange,
  buildReportRange,
  buildShareSummary,
  computeNutritionSummary,
  computeTrainingSummary,
  computeWeightTrend,
  filterPRsInRange,
  findCalorieTarget,
  sparklinePoints,
} from './client/reportMetrics';

const REPORT_DAYS = 30;
/** How many in-range PRs the report lists before truncating (print space). */
const MAX_PR_ROWS = 12;

const RECORD_TYPE_LABEL: Record<PersonalRecordRow['recordType'], string> = {
  weight: 'משקל',
  '1rm': '1RM',
  volume: 'נפח',
  reps: 'חזרות',
};

interface ReportData {
  clientName: string;
  coachName: string | null;
  sessions: WorkoutSession[];
  weights: BodyWeightEntry[];
  prs: PersonalRecordRow[];
  nutrition: NutritionLog[];
  calorieTarget: number | null;
  /** Trailing-7-days adherence rows, or null when that read failed (degrade gracefully). */
  weekAdherence: DayAdherence[] | null;
}

async function loadReportData(clientId: string): Promise<ReportData> {
  const [link, profile, sessions, weights, prs, nutrition, assignments, weekAdherence] =
    await Promise.all([
      getClientLink(clientId),
      getMyCoachProfile(),
      getClientSessions(clientId, 100, { throwOnError: true }),
      getClientBodyWeight(clientId, { throwOnError: true }),
      getClientPRs(clientId, { throwOnError: true }),
      getClientNutrition(clientId, 40, { throwOnError: true }),
      listCoachAssignments(clientId, { throwOnError: true }),
      // Adherence is a nice-to-have aggregate — a failure here must not sink
      // the whole report, so it degrades to its empty state.
      getClientWeekAdherence(clientId).catch(() => null),
    ]);
  return {
    clientName: link?.clientProfile?.displayName ?? 'מתאמן',
    coachName: profile?.businessName ?? null,
    sessions,
    weights,
    prs,
    nutrition,
    calorieTarget: findCalorieTarget(assignments),
    weekAdherence,
  };
}

export default function ClientReport() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const q = useAsyncData<ReportData | null>(() => loadReportData(id), null, [id]);
  const [notes, setNotes] = useState('');

  // Browser print dialogs derive the default PDF filename from document.title.
  const clientName = q.data?.clientName;
  useEffect(() => {
    if (!clientName) return;
    const previous = document.title;
    document.title = `דוח התקדמות — ${clientName}`;
    return () => {
      document.title = previous;
    };
  }, [clientName]);

  const range = buildReportRange(REPORT_DAYS);

  // Web Share text — built from the SAME pure aggregates the report renders, so
  // the WhatsApp message and the printout never disagree. Memoized on the data.
  const shareText = useMemo(() => {
    if (!q.data) return null;
    const training = computeTrainingSummary(q.data.sessions, range);
    const weightTrend = computeWeightTrend(q.data.weights, range);
    const prsInRange = filterPRsInRange(q.data.prs, range);
    const nutrition = computeNutritionSummary(q.data.nutrition, range, q.data.calorieTarget);
    return buildShareSummary({
      clientName: q.data.clientName,
      days: REPORT_DAYS,
      training,
      weightTrend,
      prCount: prsInRange.length,
      nutrition,
    });
  }, [q.data, range]);

  // Feature-detect Web Share (mobile/PWA) — the button stays hidden on desktop
  // where navigator.share is unavailable, so we never show a dead control.
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleShare = async () => {
    if (!shareText || !canShare) return;
    try {
      await navigator.share({ title: `דוח התקדמות — ${clientName ?? ''}`.trim(), text: shareText });
    } catch {
      // User-cancelled or share failed — non-fatal, nothing to surface.
    }
  };

  return (
    <div
      dir="rtl"
      lang="he"
      className="min-h-screen min-h-[100dvh]"
      style={{ background: 'var(--fs-bg)' }}
    >
      <PrintStyles />

      {/* Action bar — screen only, never printed. */}
      <header
        className="report-no-print flex items-center gap-3 px-5 py-4"
        style={{ borderBottom: '1px solid var(--fs-surface-2)' }}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(`/coach/clients/${id}`)}
          aria-label="חזרה"
          className="shrink-0"
        >
          {/* In RTL the chevron points back (toward the inline-start the user came from). */}
          <ChevronRight size={20} aria-hidden="true" />
        </Button>
        <div className="flex-1 min-w-0" />
        {canShare && (
          <Button
            variant="secondary"
            size="sm"
            onClick={handleShare}
            className="shrink-0 whitespace-nowrap"
            disabled={q.loading || q.data === null}
          >
            <Share2 size={16} aria-hidden="true" />
            שיתוף
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={() => window.print()}
          className="shrink-0 whitespace-nowrap"
          disabled={q.loading || q.data === null}
        >
          <Printer size={16} aria-hidden="true" />
          הדפסה / שמירה כ-PDF
        </Button>
      </header>

      <div className="client-report mx-auto w-full max-w-2xl px-5 py-6">
        {q.error ? (
          <div className="report-no-print">
            <SectionError onRetry={q.reload} />
          </div>
        ) : q.loading || q.data === null ? (
          <div className="report-no-print">
            <ListSkeleton rows={6} />
          </div>
        ) : (
          <ReportBody data={q.data} range={range} notes={notes} onNotesChange={setNotes} />
        )}
      </div>
    </div>
  );
}

// ── Report body ──────────────────────────────────────────────────────────────

function ReportBody({
  data,
  range,
  notes,
  onNotesChange,
}: {
  data: ReportData;
  range: ReportRange;
  notes: string;
  onNotesChange: (next: string) => void;
}) {
  const training = computeTrainingSummary(data.sessions, range);
  const weightTrend = computeWeightTrend(data.weights, range);
  const prsInRange = filterPRsInRange(data.prs, range);
  const nutrition = computeNutritionSummary(data.nutrition, range, data.calorieTarget);

  // Scheduled-plan adherence over the trailing week (only when a plan exists).
  const scheduled = (data.weekAdherence ?? []).reduce((sum, d) => sum + d.scheduled, 0);
  const completedScheduled = (data.weekAdherence ?? []).reduce(
    (sum, d) => sum + d.completedScheduled,
    0
  );

  return (
    <>
      {/* Report header — printed. */}
      <header className="report-section" style={sectionStyle}>
        <p style={kickerStyle}>דוח התקדמות · {REPORT_DAYS} הימים האחרונים</p>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--fs-heading)',
            margin: '4px 0 2px',
          }}
        >
          <bdi>{data.clientName}</bdi>
        </h1>
        <p style={metaTextStyle}>
          תקופה:{' '}
          <bdi dir="ltr">
            {formatDate(range.from)} – {formatDate(range.to)}
          </bdi>
        </p>
        {data.coachName && (
          <p style={metaTextStyle}>
            הופק על ידי: <bdi>{data.coachName}</bdi>
          </p>
        )}
      </header>

      {/* Training summary */}
      <ReportSection title="סיכום אימונים">
        {training.sessionCount === 0 ? (
          <InlineEmpty>אין נתונים בתקופה זו</InlineEmpty>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="אימונים" value={String(training.sessionCount)} />
              <Stat
                label="נפח כולל (ק״ג)"
                value={Math.round(training.totalVolume).toLocaleString('he-IL')}
              />
            </div>
            {scheduled > 0 && (
              <p style={{ ...metaTextStyle, marginTop: 10 }}>
                היענות לתוכנית בשבוע האחרון:{' '}
                <bdi dir="ltr">
                  {completedScheduled}/{scheduled}
                </bdi>{' '}
                אימונים מתוכננים הושלמו
              </p>
            )}
          </>
        )}
      </ReportSection>

      {/* Body weight trend */}
      <ReportSection title="מגמת משקל גוף">
        {weightTrend === null ? (
          <InlineEmpty>אין נתונים בתקופה זו</InlineEmpty>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="פתיחה" value={`${weightTrend.startWeight}`} />
              <Stat label="נוכחי" value={`${weightTrend.endWeight}`} />
              <Stat
                label="שינוי (ק״ג)"
                value={`${weightTrend.delta > 0 ? '+' : ''}${weightTrend.delta}`}
              />
            </div>
            {weightTrend.values.length > 1 && (
              <svg
                width="100%"
                height="64"
                viewBox="0 0 280 64"
                preserveAspectRatio="none"
                aria-hidden="true"
                style={{ marginTop: 12, display: 'block' }}
              >
                <polyline
                  className="report-spark"
                  points={sparklinePoints(weightTrend.values, 280, 64)}
                  fill="none"
                  stroke="var(--fs-accent)"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </>
        )}
      </ReportSection>

      {/* PRs in range */}
      <ReportSection title="שיאים אישיים">
        {prsInRange.length === 0 ? (
          <InlineEmpty>אין נתונים בתקופה זו</InlineEmpty>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {prsInRange.slice(0, MAX_PR_ROWS).map((p) => (
              <li
                key={p.id}
                className="flex items-baseline gap-2"
                style={{
                  padding: '6px 0',
                  borderBottom: '1px solid var(--fs-surface-2)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  color: 'var(--fs-ink)',
                }}
              >
                <span className="flex-1 min-w-0" style={{ fontWeight: 600 }}>
                  <bdi>{p.exerciseName}</bdi>
                </span>
                <span style={metaTextStyle}>{RECORD_TYPE_LABEL[p.recordType]}</span>
                <bdi dir="ltr" className="kinetic-number" style={{ fontSize: 14 }}>
                  {p.weight}×{p.reps}
                </bdi>
                <span style={metaTextStyle}>{formatDate(p.date)}</span>
              </li>
            ))}
            {prsInRange.length > MAX_PR_ROWS && (
              <li style={{ ...metaTextStyle, padding: '6px 0' }}>
                ועוד <bdi dir="ltr">{prsInRange.length - MAX_PR_ROWS}</bdi> שיאים בתקופה
              </li>
            )}
          </ul>
        )}
      </ReportSection>

      {/* Nutrition */}
      <ReportSection title="תזונה">
        {nutrition.daysLogged === 0 ? (
          <InlineEmpty>אין נתונים בתקופה זו</InlineEmpty>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <Stat label="ימי תיעוד" value={String(nutrition.daysLogged)} />
            <Stat
              label="ממוצע קק״ל ביום"
              value={
                nutrition.avgCalories === null ? '—' : nutrition.avgCalories.toLocaleString('he-IL')
              }
            />
            <Stat
              label="יעד קק״ל"
              value={
                nutrition.targetCalories === null
                  ? '—'
                  : nutrition.targetCalories.toLocaleString('he-IL')
              }
            />
          </div>
        )}
      </ReportSection>

      {/* Coach notes — typed for this printout only, never persisted. */}
      <ReportSection
        title="הערות המאמן"
        className={notes.trim() === '' ? 'report-notes-empty' : ''}
      >
        <div className="report-notes-input">
          <label
            htmlFor="report-coach-notes"
            style={{ ...metaTextStyle, display: 'block', marginBottom: 6 }}
          >
            הערות לדוח (יודפסו כפי שנכתבו, ללא שמירה במערכת)
          </label>
          <textarea
            id="report-coach-notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={4}
            className="w-full"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--fs-ink)',
              background: 'var(--fs-bg)',
              border: '1px solid var(--fs-surface-2)',
              padding: '8px 10px',
              resize: 'vertical',
            }}
          />
        </div>
        {/* Print mirror — textareas clip scrolled content on paper; a pre-wrap
            div prints the full text. Hidden on screen. */}
        <div
          className="report-notes-print"
          style={{
            display: 'none',
            whiteSpace: 'pre-wrap',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--fs-ink)',
            lineHeight: 1.6,
          }}
        >
          {notes}
        </div>
      </ReportSection>
    </>
  );
}

// ── Section / stat primitives ────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  background: 'var(--fs-surface)',
  border: '1px solid var(--fs-surface-2)',
  padding: '16px 18px',
  marginBottom: 12,
};

const kickerStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  letterSpacing: '-0.01em',
  color: 'var(--fs-muted)',
  margin: 0,
};

const metaTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--fs-muted)',
  margin: 0,
};

function ReportSection({
  title,
  className = '',
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`report-section ${className}`} style={sectionStyle}>
      <h2 style={{ ...kickerStyle, marginBottom: 10 }}>{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={metaTextStyle}>{label}</div>
      <div
        className="kinetic-number"
        dir="ltr"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--fs-heading)',
          textAlign: 'right',
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ── Print stylesheet ─────────────────────────────────────────────────────────
// A4-friendly print rules, mounted with the page: hide the app chrome (bottom
// nav, view-mode bar, action bar) via the visibility trick, force white paper
// with pure ink for contrast, and keep each section card unbroken across pages.
function PrintStyles() {
  return (
    <style>{`
      @page { size: A4; margin: 14mm; }
      @media print {
        .report-no-print { display: none !important; }
        /* Show ONLY the report: hides BottomNav / toasts without coupling to
           their class names. */
        body * { visibility: hidden; }
        .client-report, .client-report * { visibility: visible; }
        .client-report {
          position: absolute;
          top: 0;
          right: 0;
          left: 0;
          max-width: none;
          padding: 0;
          background: #fff !important;
          color: #000 !important;
        }
        .report-section {
          break-inside: avoid;
          page-break-inside: avoid;
          background: #fff !important;
          border-color: #bbb !important;
        }
        /* Pure ink on white for print contrast, regardless of screen theme. */
        .client-report h1,
        .client-report h2,
        .client-report p,
        .client-report div,
        .client-report span,
        .client-report li,
        .client-report bdi {
          color: #000 !important;
        }
        .report-spark { stroke: #000 !important; }
        .report-notes-input { display: none !important; }
        .report-notes-print { display: block !important; }
        .report-notes-empty { display: none !important; }
      }
    `}</style>
  );
}
