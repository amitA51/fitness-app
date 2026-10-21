// ============================================================================
// CardioDetail — the detail screen of a cardio session (/detail/:id).
// ============================================================================
// WorkoutDetail hands cardio sessions here. Right after saving (`justSaved`) it
// doubles as the "done" moment: personal records in the celebration lime, and
// an honest note when a run jumped far past the recent longest.

import { Share2 } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { ActivityIcon } from '../../components/cardio/ActivityIcon';
import PageHeader from '../../components/ui/PageHeader';
import { useData } from '../../contexts/DataContext';
import { readAthleteProfile } from '../../services/intelligence/profile';
import type { WorkoutSession } from '../../types';
import {
  type CardioEffort,
  RUN_TYPE_LABELS,
  UNIT_KM,
  cardioActivityConfig,
  cardioDistance,
  cardioEffortsOf,
  cardioPace,
  effortCalories,
  formatClock,
  formatPace,
  hrZoneOf,
  hrZones,
  longRunSpike,
  longestInPrior30Days,
  recordsHeldBy,
} from '../../utils/cardio';
import { formatHebrewDate, formatHebrewTime } from '../../utils/dateUtils';
import { logger } from '../../utils/logger';
import { shareWorkoutCard } from '../../utils/workoutShareCard';
import { effectiveHrMax, useCardioPrefs } from './cardioPrefs';
import { RouteMap } from './components/RouteMap';
import './cardio.css';

const ZONE_NAMES = ['', 'התאוששות', 'קל', 'בינוני', 'מאומץ', 'מקסימלי'] as const;

const EFFORT_NAMES: Record<number, string> = {
  2: 'קל מאוד',
  4: 'קל',
  6: 'בינוני',
  8: 'קשה',
  10: 'מקסימלי',
};

function effortName(rpe: number): string {
  return EFFORT_NAMES[rpe] ?? `${rpe} מתוך 10`;
}

interface StatProps {
  label: string;
  value: string;
  unit?: string;
  note?: string;
}

function Stat({ label, value, unit, note }: StatProps) {
  return (
    <div className="cardio-stat">
      <span className="cardio-stat-label">{label}</span>
      <span>
        <span className="cardio-stat-value kinetic-number">{value}</span>
        {unit && <span className="cardio-stat-unit"> {unit}</span>}
      </span>
      {note && <span className="cardio-stat-unit">{note}</span>}
    </div>
  );
}

/** One line for sharing: "ריצה · 5.2 ק״מ · 28:40 · 5:31 דק׳/ק״מ". */
export function cardioShareText(effort: CardioEffort): string {
  const config = cardioActivityConfig(effort.activity);
  const parts = [config.label];
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

export default function CardioDetail({ session, justSaved, onBack }: CardioDetailProps) {
  const { sessions } = useData();
  const prefs = useCardioPrefs();
  const efforts = useMemo(() => cardioEffortsOf(session), [session]);
  const effort = efforts[0] as CardioEffort;
  const config = cardioActivityConfig(effort.activity);

  const totalKm = efforts.reduce((s, e) => s + e.distanceKm, 0);
  const totalSec = efforts.reduce((s, e) => s + e.durationSec, 0);
  const weightKg = readAthleteProfile().weightKg;
  const calories = session.caloriesBurned ?? effortCalories(effort, weightKg);

  const records = useMemo(() => recordsHeldBy(session.id, sessions), [session.id, sessions]);
  const spike = useMemo(() => {
    if (effort.discipline !== 'running' || effort.distanceKm <= 0) return null;
    const start = new Date(session.startTime).getTime();
    return longRunSpike(effort.distanceKm, longestInPrior30Days(sessions, start, 'running'));
  }, [effort, session.startTime, sessions]);

  const zones = useMemo(() => {
    const max = effectiveHrMax(prefs, readAthleteProfile().age);
    return max ? hrZones(max.hrMax, prefs.restingHr) : [];
  }, [prefs]);
  const zone = hrZoneOf(effort.avgHr, zones);

  const dist = cardioDistance(effort.activity, totalKm);
  const pace = cardioPace(effort.activity, totalKm, totalSec);
  const splits = effort.splits;
  const fastestSplit = splits.length
    ? Math.min(...splits.map((s) => s.seconds / s.distanceKm))
    : null;
  const slowestSplit = splits.length
    ? Math.max(...splits.map((s) => s.seconds / s.distanceKm))
    : null;

  const handleShare = useCallback(async () => {
    const text = cardioShareText({ ...effort, distanceKm: totalKm, durationSec: totalSec });
    // The designed image first (distance as the hero), plain text as fallback.
    const heroDist = cardioDistance(effort.activity, totalKm);
    const heroPace = cardioPace(effort.activity, totalKm, totalSec);
    if (heroDist) {
      const result = await shareWorkoutCard({
        totalVolume: 0,
        totalSets: effort.sets,
        durationSec: totalSec,
        prsCount: records.length,
        hero: {
          value: heroDist.value,
          label: `${heroDist.unit} ${config.label}`,
          secondary: heroPace ? { value: heroPace.value, label: heroPace.unit } : undefined,
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
  }, [effort, totalKm, totalSec, records.length, config.label]);

  return (
    <div style={{ background: 'var(--fs-bg)', minHeight: '100%' }} dir="rtl">
      <PageHeader
        title={config.label}
        eyebrow={
          <span>
            {formatHebrewDate(session.date || session.startTime)} ·{' '}
            <span dir="ltr">{formatHebrewTime(session.startTime)}</span>
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
              {records.map((r) => (
                <span key={`${r.kind}-${r.distanceKm}`}>
                  {r.kind === 'longest' ? (
                    <>
                      המרחק הארוך ביותר שלך: <span className="kinetic-number">{dist?.value}</span>{' '}
                      {dist?.unit ?? UNIT_KM}
                    </>
                  ) : (
                    <>
                      {r.label} ב־<span className="kinetic-number">{formatClock(r.seconds)}</span>
                    </>
                  )}
                </span>
              ))}
            </div>
          )}

          {spike !== null && (
            <div className="cardio-banner" data-tone="warn">
              <strong>
                ארוכה ב־<span className="kinetic-number">{Math.round(spike * 100)}%</span> מהריצה
                הארוכה ביותר שלך בחודש שלפניה
              </strong>
              <span>
                קפיצה חדה במרחק של ריצה אחת קשורה לסיכון גבוה יותר לפציעה. עדיף להאריך בהדרגה, עד
                כ־10% בכל פעם.
              </span>
            </div>
          )}

          <section className="cardio-detail-hero" aria-label="סיכום">
            <span className="cardio-detail-kicker">
              <ActivityIcon activity={effort.activity} size={18} />
              {config.label}
              {effort.runType && ` · ${RUN_TYPE_LABELS[effort.runType]}`}
              {session.exercises.some((ex) => ex.external?.provider === 'strava') && ' · מ-Strava'}
            </span>
            <p className="cardio-detail-big">
              <span className="cardio-detail-big-value kinetic-number">
                {dist ? dist.value : formatClock(totalSec)}
              </span>
              {dist && <span className="cardio-detail-big-unit">{dist.unit}</span>}
            </p>
            {dist && (
              <p className="cardio-detail-sub">
                <span className="kinetic-number">{formatClock(totalSec)}</span>
                {pace && (
                  <>
                    {' · '}
                    <span className="kinetic-number">{pace.value}</span> {pace.unit}
                  </>
                )}
              </p>
            )}
          </section>

          <div className="cardio-stats">
            <Stat label="זמן" value={formatClock(totalSec)} />
            {pace && (
              <Stat
                label={config.paceStyle === 'speed' ? 'מהירות ממוצעת' : 'קצב ממוצע'}
                value={pace.value}
                unit={pace.unit}
              />
            )}
            {calories !== null && calories > 0 && (
              <Stat
                label="קלוריות"
                value={String(calories)}
                note={effort.typedCalories !== null ? 'מהשעון' : 'הערכה'}
              />
            )}
            {effort.avgHr !== null && (
              <Stat
                label="דופק ממוצע"
                value={String(effort.avgHr)}
                unit="bpm"
                note={zone ? `אזור ${zone} · ${ZONE_NAMES[zone]}` : undefined}
              />
            )}
            {effort.maxHr !== null && (
              <Stat label="דופק מרבי" value={String(effort.maxHr)} unit="bpm" />
            )}
            {effort.elevationGainM > 0 && (
              <Stat
                label="עלייה מצטברת"
                value={String(Math.round(effort.elevationGainM))}
                unit="מ׳"
              />
            )}
            {effort.effort !== null && <Stat label="מאמץ" value={effortName(effort.effort)} />}
            {effort.sets > 1 && <Stat label="מקטעים" value={String(effort.sets)} />}
          </div>

          {effort.route && effort.route.points.length >= 2 && (
            <section aria-labelledby="cardio-route-title">
              <h2 id="cardio-route-title" className="cardio-section-title">
                המסלול
              </h2>
              <RouteMap points={effort.route.points} label={`צורת המסלול של ה${config.label}`} />
            </section>
          )}

          {splits.length > 0 && fastestSplit !== null && slowestSplit !== null && (
            <section aria-labelledby="cardio-splits-title">
              <h2 id="cardio-splits-title" className="cardio-section-title">
                קילומטרים
              </h2>
              <div style={{ display: 'grid', gap: 4 }}>
                {splits.map((s) => {
                  const perKm = s.seconds / s.distanceKm;
                  // Faster = longer bar; the slowest still shows a sliver.
                  const range = slowestSplit - fastestSplit || 1;
                  const width = 35 + 65 * ((slowestSplit - perKm) / range);
                  return (
                    <div
                      key={s.index}
                      className="cardio-split-row"
                      data-best={perKm === fastestSplit && splits.length > 1 ? 'true' : undefined}
                    >
                      <span>
                        {s.distanceKm < 1 ? (
                          <span className="kinetic-number">
                            {Math.round(s.distanceKm * 1000)} מ׳
                          </span>
                        ) : (
                          <>
                            ק״מ <span className="kinetic-number">{s.index}</span>
                          </>
                        )}
                      </span>
                      <span className="cardio-split-bar" aria-hidden="true">
                        <span style={{ width: `${width}%` }} />
                      </span>
                      <span className="kinetic-number" style={{ textAlign: 'end' }}>
                        {formatPace(perKm)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {efforts.length > 1 && (
            <section aria-labelledby="cardio-parts-title">
              <h2 id="cardio-parts-title" className="cardio-section-title">
                חלקי האימון
              </h2>
              <div style={{ display: 'grid', gap: 8 }}>
                {efforts.map((e) => {
                  const d = cardioDistance(e.activity, e.distanceKm);
                  return (
                    <div key={e.exerciseId} className="cardio-stat">
                      <span className="cardio-stat-label">
                        {cardioActivityConfig(e.activity).label}
                      </span>
                      <span>
                        <span className="kinetic-number">{formatClock(e.durationSec)}</span>
                        {d && (
                          <>
                            {' · '}
                            <span className="kinetic-number">{d.value}</span> {d.unit}
                          </>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
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
