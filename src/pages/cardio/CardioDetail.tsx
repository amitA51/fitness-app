// ============================================================================
// CardioDetail — the detail screen of a cardio session (/detail/:id).
// ============================================================================
// WorkoutDetail hands cardio sessions here. Right after saving (`justSaved`) it
// doubles as the "done" moment: personal records in the celebration lime. For
// a run, the coach card follows the numbers — what the run says, what to do
// now, and the AI coach's full review on request.
//
// A session may hold several cardio parts. The hero and the stats add up every
// part; splits, the route and the coach notes always read ONE part (each part
// on its own card when there are several, the running part for the coach).

import { Share2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { ActivityIcon } from '../../components/cardio/ActivityIcon';
import PageHeader from '../../components/ui/PageHeader';
import { useData } from '../../contexts/DataContext';
import { readAthleteProfile } from '../../services/intelligence/profile';
import { effectiveHrMax, useCardioPrefs } from '../../services/running/cardioPrefs';
import type { WorkoutSession } from '../../types';
import {
  type CardioEffort,
  RUN_TYPE_LABELS,
  UNIT_KM,
  cardioActivityConfig,
  cardioDistance,
  cardioEffortsOf,
  cardioPace,
  formatClock,
  hrZoneOf,
  hrZones,
  recordsHeldBy,
} from '../../utils/cardio';
import { formatHebrewDate, formatHebrewTime } from '../../utils/dateUtils';
import { logger } from '../../utils/logger';
import { shareWorkoutCard } from '../../utils/workoutShareCard';
import { RouteMap } from './components/RouteMap';
import { CardioParts } from './detail/CardioParts';
import { CardioStats } from './detail/CardioStats';
import { RunCoachCard } from './detail/RunCoachCard';
import { SplitList } from './detail/SplitList';
import {
  insightsForRun,
  isLatestRun,
  partsLabel,
  primaryEffort,
  summarizeEfforts,
} from './detail/detailModel';
import { reviewCacheKey } from './detail/runReviewCache';
import './cardio.css';
import './detail/detail.css';

/** One line for sharing: "ריצה · 5.2 ק״מ · 28:40 · 5:31 דק׳/ק״מ". */
export function cardioShareText(effort: CardioEffort, label?: string): string {
  const config = cardioActivityConfig(effort.activity);
  const parts = [label || config.label];
  const dist = cardioDistance(effort.activity, effort.distanceKm);
  if (dist) parts.push(`${dist.value} ${dist.unit}`);
  parts.push(formatClock(effort.durationSec));
  const pace = cardioPace(effort.activity, effort.distanceKm, effort.durationSec);
  if (pace) parts.push(`${pace.value} ${pace.unit}`);
  return `${parts.join(' · ')}\nנרשם ב־SparkOS Fitness`;
}

interface CardioDetailProps {
  session: WorkoutSession;
  justSaved: boolean;
  onBack: () => void;
}

export default function CardioDetail(props: CardioDetailProps) {
  const efforts = useMemo(() => cardioEffortsOf(props.session), [props.session]);
  const primary = useMemo(() => primaryEffort(efforts), [efforts]);
  // WorkoutDetail only routes real cardio sessions here; nothing recorded → nothing to show.
  if (!primary) return null;
  return <CardioDetailView {...props} efforts={efforts} primary={primary} />;
}

interface CardioDetailViewProps extends CardioDetailProps {
  efforts: CardioEffort[];
  primary: CardioEffort;
}

function CardioDetailView({ session, justSaved, onBack, efforts, primary }: CardioDetailViewProps) {
  const { sessions } = useData();
  const prefs = useCardioPrefs();
  const config = cardioActivityConfig(primary.activity);
  const multi = efforts.length > 1;

  const summary = useMemo(
    () => summarizeEfforts(efforts, readAthleteProfile().weightKg, session.caloriesBurned),
    [efforts, session.caloriesBurned]
  );
  // Records of the part the screen is about, not of whichever part came first.
  const records = useMemo(
    () => recordsHeldBy(session.id, sessions, primary.discipline),
    [session.id, primary.discipline, sessions]
  );
  const hrMax = useMemo(() => effectiveHrMax(prefs, readAthleteProfile().age), [prefs]);
  const zones = useMemo(
    () => (hrMax ? hrZones(hrMax.hrMax, prefs.restingHr) : []),
    [hrMax, prefs.restingHr]
  );

  // The coach reads the running part; a ride or a swim gets no running notes.
  const runPart = primary.discipline === 'running' ? primary : null;
  const insights = useMemo(
    () => (runPart ? insightsForRun(runPart, session, sessions, hrMax?.hrMax ?? null) : []),
    [runPart, session, sessions, hrMax]
  );
  const latest = useMemo(
    () => (runPart ? isLatestRun(session, sessions) : false),
    [runPart, session, sessions]
  );

  // Totals add up only when every part is the same kind of effort; a walk +
  // run session shows its time, and each part's distance below.
  const dist = summary.uniform ? cardioDistance(primary.activity, summary.distanceKm) : null;
  const pace = summary.uniform
    ? cardioPace(primary.activity, summary.distanceKm, summary.durationSec)
    : null;
  const when = formatHebrewDate(session.date || session.startTime);
  const reviewKey = reviewCacheKey(session.id, session.updatedAt);
  // Parts of different kinds (a walk and a run): the screen is named after all
  // of them, so the total time is not read as the run's.
  const mixed = multi && !summary.uniform;
  const title = mixed ? partsLabel(efforts) : config.label;
  const runParts = efforts.filter((e) => e.discipline === 'running').length;
  const partNote = !multi
    ? null
    : runParts > 1
      ? 'על חלק הריצה הארוך באימון.'
      : 'על חלק הריצה באימון.';

  const handleShare = useCallback(async () => {
    const shared: CardioEffort = {
      ...primary,
      distanceKm: summary.uniform ? summary.distanceKm : 0,
      durationSec: summary.durationSec,
    };
    const text = cardioShareText(shared, title);
    // The designed image first (distance as the hero), plain text as fallback.
    if (dist) {
      const result = await shareWorkoutCard({
        totalVolume: 0,
        totalSets: efforts.reduce((n, e) => n + e.sets, 0),
        durationSec: summary.durationSec,
        prsCount: records.length,
        hero: {
          value: dist.value,
          label: `${dist.unit} ${title}`,
          secondary: pace ? { value: pace.value, label: pace.unit } : undefined,
        },
      }).catch(() => 'unsupported' as const);
      if (result !== 'unsupported') return;
    }
    try {
      if (navigator.share) await navigator.share({ text });
      else if (navigator.clipboard) await navigator.clipboard.writeText(text);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError')
        logger.workout.error('cardio share failed', err);
    }
  }, [primary, summary, dist, pace, efforts, records.length, title]);

  return (
    <div style={{ background: 'var(--fs-bg)', minHeight: '100%' }} dir="rtl">
      <PageHeader
        title={title}
        eyebrow={
          <span>
            {when} · <span dir="ltr">{formatHebrewTime(session.startTime)}</span>
          </span>
        }
        onBack={onBack}
        action={
          <button
            type="button"
            className="cardio-icon-btn focus-ring"
            aria-label="שיתוף"
            onClick={handleShare}
          >
            <Share2 size={18} aria-hidden="true" />
          </button>
        }
      />

      <div className="page-shell" style={{ paddingTop: 16 }}>
        <div className="page-stack">
          {justSaved && records.length === 0 && (
            <div className="cardio-banner" role="status">
              <strong>נשמר.</strong>
              <span>האימון נכנס להיסטוריה, ללוח השנה ולספירת השבוע.</span>
            </div>
          )}

          {records.length > 0 && (
            <div
              className="cardio-banner"
              data-tone="record"
              role={justSaved ? 'status' : undefined}
            >
              <strong>{justSaved ? 'שיא אישי חדש!' : 'שיא אישי'}</strong>
              {records.map((r) => {
                const longest = cardioDistance(primary.activity, r.distanceKm);
                return (
                  <span key={`${r.kind}-${r.distanceKm}`}>
                    {r.kind === 'longest' ? (
                      <>
                        המרחק הארוך ביותר שלך:{' '}
                        <span className="kinetic-number">{longest?.value}</span>{' '}
                        {longest?.unit ?? UNIT_KM}
                      </>
                    ) : (
                      <>
                        {r.label} ב־<span className="kinetic-number">{formatClock(r.seconds)}</span>
                      </>
                    )}
                  </span>
                );
              })}
            </div>
          )}

          <section className="cardio-detail-hero" aria-label="סיכום">
            <span className="cardio-detail-kicker">
              <ActivityIcon activity={primary.activity} size={18} />
              {title}
              {!mixed && primary.runType && ` · ${RUN_TYPE_LABELS[primary.runType]}`}
              {session.exercises.some((ex) => ex.external?.provider === 'strava') && ' · מ-Strava'}
            </span>
            <p className="cardio-detail-big">
              <span className="cardio-detail-big-value kinetic-number">
                {dist ? dist.value : formatClock(summary.durationSec)}
              </span>
              {dist && <span className="cardio-detail-big-unit">{dist.unit}</span>}
            </p>
            {!dist && multi && (
              <p className="cardio-detail-sub">
                <span className="kinetic-number">{efforts.length}</span> חלקים
              </p>
            )}
          </section>

          <CardioStats
            summary={summary}
            pace={pace}
            paceLabel={config.paceStyle === 'speed' ? 'מהירות ממוצעת' : 'קצב ממוצע'}
            showTime={dist !== null}
            zone={hrZoneOf(summary.avgHr, zones)}
            sets={multi ? 1 : primary.sets}
          />

          {runPart && (
            <RunCoachCard
              // A new run, or an edit of this one, starts the review afresh.
              key={reviewKey}
              sessionId={session.id}
              cacheKey={reviewKey}
              effort={runPart}
              when={when}
              insights={insights}
              isLatest={latest}
              partNote={partNote}
            />
          )}

          {multi ? (
            <CardioParts efforts={efforts} />
          ) : (
            <>
              {primary.route && primary.route.points.length >= 2 && (
                <section aria-labelledby="cardio-route-title">
                  <h2 id="cardio-route-title" className="cardio-section-title">
                    המסלול
                  </h2>
                  <RouteMap
                    points={primary.route.points}
                    label={`צורת המסלול של ה${config.label}`}
                  />
                </section>
              )}
              {primary.splits.length > 0 && (
                <section aria-labelledby="cardio-splits-title">
                  <h2 id="cardio-splits-title" className="cardio-section-title">
                    קילומטרים
                  </h2>
                  <SplitList splits={primary.splits} />
                </section>
              )}
            </>
          )}

          {session.notes && (
            <section className="cardio-stat" aria-label="הערות">
              <span className="cardio-stat-label">הערות</span>
              <p
                dir="auto"
                style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.6 }}
              >
                {session.notes}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
