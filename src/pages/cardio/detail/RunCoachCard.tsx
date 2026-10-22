// ============================================================================
// "מה המאמן אומר" — the coach's notes on one run, under the hero stats.
// ============================================================================
// The deterministic notes first (pacing, heart-rate drift, the easy run that
// was not easy, the long-run jump, heat), most important first; for the
// latest run, what to do now; then, on request, the AI coach's full review.

import { AlertTriangle, CheckCircle2, ChevronLeft, Lightbulb, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { useRunningCoach } from '../../../hooks/useRunningCoach';
import type { InsightTone, RunInsight } from '../../../services/running';
import type { CardioEffort } from '../../../utils/cardio';
import { RunAiReview } from './RunAiReview';

const TONE_ICON: Record<InsightTone, LucideIcon> = {
  good: CheckCircle2,
  note: Lightbulb,
  warn: AlertTriangle,
};

/** Whole kilometres the notes need before they can read the pacing. */
const SPLITS_FOR_PACING = 4;

function InsightItem({ insight }: { insight: RunInsight }) {
  const Icon = TONE_ICON[insight.tone];
  return (
    <li className="run-insight" data-tone={insight.tone}>
      <span className="run-insight-icon" aria-hidden="true">
        <Icon size={16} strokeWidth={2.2} />
      </span>
      <div>
        <p className="run-insight-title">
          {insight.tone === 'warn' && <span className="sr-only">חשוב: </span>}
          {insight.title}
        </p>
        <p className="run-insight-body">{insight.body}</p>
      </div>
    </li>
  );
}

interface RunCoachCardProps {
  sessionId: string;
  cacheKey: string;
  /** The running part the notes are about. */
  effort: CardioEffort;
  /** When the run happened, in words — for the AI review. */
  when: string;
  insights: readonly RunInsight[];
  /** No run came after this one, so "what now" belongs here. */
  isLatest: boolean;
  /** In a session of several parts: which part the notes are about. */
  partNote: string | null;
}

export function RunCoachCard({
  sessionId,
  cacheKey,
  effort,
  when,
  insights,
  isLatest,
  partNote,
}: RunCoachCardProps) {
  const coach = useRunningCoach();
  const { user } = useAuth();
  const hasPacingSplits = effort.splits.length >= SPLITS_FOR_PACING;

  return (
    <section className="run-coach" aria-labelledby="run-coach-title">
      <div className="run-coach-head">
        <h2 id="run-coach-title" className="cardio-section-title">
          מה המאמן אומר
        </h2>
        <Link to="/cardio/coach" className="run-coach-link focus-ring">
          לכל ההמלצות
          <ChevronLeft size={16} aria-hidden="true" />
        </Link>
      </div>

      {partNote && <p className="run-coach-muted">{partNote}</p>}

      {insights.length > 0 ? (
        <ul className="run-insights">
          {insights.map((i) => (
            <InsightItem key={i.id} insight={i} />
          ))}
        </ul>
      ) : (
        <p className="run-coach-muted">
          {hasPacingSplits
            ? 'אין הערות מיוחדות לריצה הזאת.'
            : 'אין הערות מיוחדות לריצה הזאת. כשנרשם קצב לכל קילומטר — במעקב החי או מ-Strava — המאמן יכול לומר יותר.'}
        </p>
      )}

      {isLatest && coach.hasRuns && (
        <div className="run-coach-next">
          <span className="run-coach-next-label">מה עכשיו</span>
          <strong className="run-coach-next-title">{coach.next.title}</strong>
          <span className="run-coach-next-detail">{coach.next.detail}</span>
        </div>
      )}

      {user ? (
        <RunAiReview
          sessionId={sessionId}
          cacheKey={cacheKey}
          effort={effort}
          when={when}
          insights={insights}
          coach={coach}
        />
      ) : (
        <p className="run-coach-muted">התחברו לחשבון כדי לקבל ניתוח מלא של המאמן.</p>
      )}
    </section>
  );
}
