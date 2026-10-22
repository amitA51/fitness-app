// Cardio other than running in the last 30 days, one row per discipline.

import {
  CARDIO_DISCIPLINE_LABELS,
  type CardioDiscipline,
  type DisciplineTotal,
  UNIT_KM,
  formatClock,
  formatKm,
} from '../../../../utils/cardio';
import { SectionCard } from '../../components/SectionCard';
import { rowStyle, titleStyle } from './styles';

/** Here "other" is mostly gym machines (elliptical, stairs), so it says so. */
const LABELS: Readonly<Record<CardioDiscipline, string>> = {
  ...CARDIO_DISCIPLINE_LABELS,
  other: 'מכשירים ואחר',
};

export function OtherCardioCard({ totals }: { totals: readonly DisciplineTotal[] }) {
  return (
    <SectionCard>
      <h3 style={{ ...titleStyle, marginBottom: 6 }}>אירובי נוסף ב־30 הימים האחרונים</h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {totals.map((t) => (
          <li key={t.discipline} style={rowStyle}>
            <span>{LABELS[t.discipline]}</span>
            <span>
              {t.distanceKm > 0 && (
                <>
                  <span className="kinetic-number">{formatKm(t.distanceKm)}</span> {UNIT_KM} ·{' '}
                </>
              )}
              <span className="kinetic-number">{formatClock(t.durationSec)}</span>
            </span>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
