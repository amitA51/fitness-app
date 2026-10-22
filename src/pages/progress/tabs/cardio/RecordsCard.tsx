// Running records: the fastest time per record distance and the longest run,
// each row opening the run it came from.

import { ChevronLeft, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  type CardioRecords,
  RECORD_DISTANCES,
  UNIT_KM,
  formatClock,
  formatKm,
} from '../../../../utils/cardio';
import { formatHebrewDate } from '../../../../utils/dateUtils';
import { SectionCard } from '../../components/SectionCard';
import { mutedStyle, rowStyle, titleStyle } from './styles';

export function RecordsCard({ records }: { records: CardioRecords }) {
  const navigate = useNavigate();
  return (
    <SectionCard>
      <h3
        style={{
          ...titleStyle,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <Trophy size={16} aria-hidden="true" style={{ color: 'var(--fs-accent-2)' }} />
        שיאים אישיים בריצה
      </h3>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {RECORD_DISTANCES.map((d) => {
          const r = records.fastest.get(d.km);
          if (!r) return null;
          return (
            <li key={d.km}>
              <button
                type="button"
                className="focus-ring"
                onClick={() => navigate(`/detail/${r.sessionId}`)}
                style={{
                  ...rowStyle,
                  width: '100%',
                  background: 'none',
                  border: 0,
                  borderBottom: rowStyle.borderBottom,
                  cursor: 'pointer',
                  textAlign: 'start',
                }}
              >
                <span>{d.label}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong className="kinetic-number">{formatClock(r.seconds)}</strong>
                  <span style={{ fontSize: 13, color: 'var(--fs-muted)' }}>
                    {formatHebrewDate(r.date)}
                  </span>
                  <ChevronLeft size={16} aria-hidden="true" style={{ color: 'var(--fs-muted)' }} />
                </span>
              </button>
            </li>
          );
        })}
        {records.longest && (
          <li>
            <button
              type="button"
              className="focus-ring"
              onClick={() => navigate(`/detail/${records.longest?.sessionId}`)}
              style={{
                ...rowStyle,
                width: '100%',
                background: 'none',
                border: 0,
                cursor: 'pointer',
                textAlign: 'start',
              }}
            >
              <span>הריצה הארוכה ביותר</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>
                  <span className="kinetic-number">{formatKm(records.longest.distanceKm)}</span>{' '}
                  {UNIT_KM}
                </strong>
                <span style={{ fontSize: 13, color: 'var(--fs-muted)' }}>
                  {formatHebrewDate(records.longest.date)}
                </span>
                <ChevronLeft size={16} aria-hidden="true" style={{ color: 'var(--fs-muted)' }} />
              </span>
            </button>
          </li>
        )}
      </ul>
      <p style={{ ...mutedStyle, marginTop: 8 }}>
        ריצה ארוכה מהמרחק עד 10% נספרת לפי הקצב הממוצע שלה. עם GPS נמדד גם הקטע המהיר בתוך ריצה
        ארוכה.
      </p>
    </SectionCard>
  );
}
