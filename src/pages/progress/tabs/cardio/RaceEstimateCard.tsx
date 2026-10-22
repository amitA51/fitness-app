// Race-time estimates from the best recent run (Riegel).

import {
  type DatedEffort,
  UNIT_KM,
  formatClock,
  formatKm,
  predictRaceSec,
} from '../../../../utils/cardio';
import { SectionCard } from '../../components/SectionCard';
import { mutedStyle, rowStyle, titleStyle } from './styles';

const RACE_TARGETS = [
  { km: 5, label: '5 ק״מ' },
  { km: 10, label: '10 ק״מ' },
  { km: 21.0975, label: 'חצי מרתון' },
] as const;

export function RaceEstimateCard({ best }: { best: DatedEffort }) {
  return (
    <SectionCard>
      <h3 style={{ ...titleStyle, marginBottom: 6 }}>זמן משוער למרוץ</h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {RACE_TARGETS.map((t) => {
          const sec = predictRaceSec(best.durationSec, best.distanceKm, t.km);
          if (!sec) return null;
          return (
            <li key={t.km} style={rowStyle}>
              <span>{t.label}</span>
              <strong className="kinetic-number">{formatClock(sec)}</strong>
            </li>
          );
        })}
      </ul>
      <p style={{ ...mutedStyle, marginTop: 8 }}>
        הערכה לפי הריצה הטובה ביותר שלכם ב־90 הימים האחרונים (
        <span className="kinetic-number">{formatKm(best.distanceKm)}</span> {UNIT_KM} ב־
        <span className="kinetic-number">{formatClock(best.durationSec)}</span>). בפועל זה תלוי
        באימון, במסלול ובמזג האוויר.
      </p>
    </SectionCard>
  );
}
