// ============================================================================
// COACH — how a trainee's cardio reads on the coach screens
// ============================================================================
// A run is an ordinary session with zero lifting volume, so every coach list
// that printed "0 ק״ג נפח · 1 תרגילים" for it asks this module instead: a
// cardio-only session reads as its activity + time/distance; a gym session
// with a treadmill block keeps its volume line and adds the block's time.

import { CardioEffortLine } from '../../../components/cardio/CardioEffortLine';
import type { CardioPeriodTotal } from '../../../services/coach/coachAnalytics';
import type { CardioActivity, WorkoutExercise, WorkoutSession } from '../../../types';
import {
  CATALOG_NAME_TO_ACTIVITY,
  type CardioEffort,
  cardioActivityConfig,
  cardioEffortsOf,
  isCardioSession,
  resolveCardioActivity,
  sessionCardioTotals,
} from '../../../utils/cardio';
import { cardioTotalParts } from './reportMetrics';

type EffortLine = Pick<CardioEffort, 'activity' | 'distanceKm' | 'durationSec'>;

/** One time/distance line of a session row. */
export interface CardioPiece {
  key: string;
  /** Activity label before the line ("הליכון"); null when the row title names it. */
  label: string | null;
  effort: EffortLine;
  withPace: boolean;
}

export interface SessionCardioView {
  /** A cardio session (no lifting) — a run, a ride, a pool swim. */
  cardioOnly: boolean;
  /** Hebrew activity label of a cardio-only session ("ריצה"), else null. */
  title: string | null;
  activity: CardioActivity | null;
  pieces: CardioPiece[];
}

const NO_CARDIO: SessionCardioView = { cardioOnly: false, title: null, activity: null, pieces: [] };

/** The cardio side of one session, as the coach lists show it. Pure. */
export function sessionCardioView(session: Pick<WorkoutSession, 'exercises'>): SessionCardioView {
  const efforts = cardioEffortsOf(session);
  const first = efforts[0];
  if (!first) return NO_CARDIO;
  if (isCardioSession(session)) {
    const totals = sessionCardioTotals(session);
    return {
      cardioOnly: true,
      title: cardioActivityConfig(first.activity).label,
      activity: first.activity,
      // A pace across two different activities means nothing — only for one.
      pieces: [
        {
          key: 'total',
          label: null,
          effort: { activity: first.activity, ...totals },
          withPace: efforts.length === 1,
        },
      ],
    };
  }
  return {
    cardioOnly: false,
    title: null,
    activity: null,
    pieces: efforts.map((e, i) => ({
      key: `${e.exerciseId}-${i}`,
      label: cardioActivityConfig(e.activity).label,
      effort: e,
      withPace: false,
    })),
  };
}

/**
 * Name of a cardio exercise for a coach row: the short activity label for a
 * built-in ("ריצה" instead of "ריצה | Running"), the trainee's own name otherwise.
 */
export function cardioExerciseName(ex: WorkoutExercise): string {
  const activity = resolveCardioActivity(ex);
  const name = (ex.exerciseName || ex.name || '').trim();
  if (!activity) return name;
  if (!name || CATALOG_NAME_TO_ACTIVITY.has(name)) return cardioActivityConfig(activity).label;
  return name;
}

/** "הליכון 10:00 · 1.5 ק״מ" pieces, joined with a middle dot. */
export function SessionCardioLine({
  pieces,
  leadingDot = false,
}: {
  pieces: readonly CardioPiece[];
  /** Prefix a " · " (the line continues a meta string). */
  leadingDot?: boolean;
}) {
  return (
    <>
      {pieces.map((p, i) => (
        <span key={p.key}>
          {(leadingDot || i > 0) && ' · '}
          {p.label && `${p.label} `}
          <CardioEffortLine effort={p.effort} withPace={p.withPace} />
        </span>
      ))}
    </>
  );
}

/** Period cardio per discipline: "ריצה: 18.4 ק״מ ב־3 ריצות · 1:42:10". */
export function CardioTotals({ totals }: { totals: readonly CardioPeriodTotal[] }) {
  if (totals.length === 0) return null;
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      {totals.map((t) => {
        const p = cardioTotalParts(t);
        return (
          <li
            key={t.discipline}
            style={{
              padding: '4px 0',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--fs-ink)',
            }}
          >
            <span style={{ fontWeight: 600 }}>{p.label}:</span>{' '}
            {p.distance ? (
              <>
                <span className="kinetic-number">{p.distance.value}</span> {p.distance.unit}{' '}
                {p.countText}
                {p.clock && (
                  <>
                    {' · '}
                    <span className="kinetic-number">{p.clock}</span>
                  </>
                )}
              </>
            ) : (
              <>
                <span className="kinetic-number">{p.clock}</span> {p.countText}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
