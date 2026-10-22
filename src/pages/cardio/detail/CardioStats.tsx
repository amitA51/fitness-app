// The stat tiles under the hero: time, pace, calories, heart rate, climb,
// effort — whichever the session recorded. The hero holds the one big number;
// everything else lives here, labelled, once.

import { type ValueWithUnit, formatClock } from '../../../utils/cardio';
import type { CardioSummary } from './detailModel';

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

interface CardioStatsProps {
  summary: CardioSummary;
  pace: ValueWithUnit | null;
  paceLabel: string;
  /** False when the hero's big number already is the time. */
  showTime: boolean;
  /** Heart-rate zone of the average, 1–5. */
  zone: number | null;
  /** Intervals of a single-part session (1 = not shown). */
  sets: number;
}

export function CardioStats({ summary, pace, paceLabel, showTime, zone, sets }: CardioStatsProps) {
  const { calories, avgHr, maxHr, elevationGainM, effort } = summary;
  const tiles = [
    showTime && <Stat key="time" label="זמן" value={formatClock(summary.durationSec)} />,
    pace && <Stat key="pace" label={paceLabel} value={pace.value} unit={pace.unit} />,
    calories !== null && calories > 0 && (
      <Stat
        key="kcal"
        label="קלוריות"
        value={String(calories)}
        note={summary.caloriesFromWatch ? 'מהשעון' : 'הערכה'}
      />
    ),
    avgHr !== null && (
      <Stat
        key="avg-hr"
        label="דופק ממוצע"
        value={String(avgHr)}
        unit="bpm"
        note={zone ? `אזור ${zone} · ${ZONE_NAMES[zone]}` : undefined}
      />
    ),
    maxHr !== null && <Stat key="max-hr" label="דופק מרבי" value={String(maxHr)} unit="bpm" />,
    elevationGainM > 0 && (
      <Stat key="climb" label="עלייה מצטברת" value={String(Math.round(elevationGainM))} unit="מ׳" />
    ),
    effort !== null && <Stat key="effort" label="מאמץ" value={effortName(effort)} />,
    sets > 1 && <Stat key="sets" label="מקטעים" value={String(sets)} />,
  ].filter(Boolean);

  if (tiles.length === 0) return null;
  return <div className="cardio-stats">{tiles}</div>;
}
