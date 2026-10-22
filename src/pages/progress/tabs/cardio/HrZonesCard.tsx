// The five heart-rate zones, from a measured or age-estimated max HR (and the
// resting HR when there is one).

import { HeartPulse, Pencil } from 'lucide-react';
import { readAthleteProfile } from '../../../../services/intelligence/profile';
import { type CardioPrefs, effectiveHrMax } from '../../../../services/running/cardioPrefs';
import { hrZones } from '../../../../utils/cardio';
import { SectionCard } from '../../components/SectionCard';
import { mutedStyle, rowStyle, titleStyle } from './styles';

const ZONES = [
  { name: 'התאוששות', hint: 'הליכה, חימום' },
  { name: 'קל', hint: 'אפשר לנהל שיחה' },
  { name: 'בינוני', hint: 'מדברים במשפטים קצרים' },
  { name: 'מאומץ', hint: 'טמפו, קשה לדבר' },
  { name: 'מקסימלי', hint: 'ספרינטים קצרים' },
] as const;

export function HrZonesCard({ prefs, onEdit }: { prefs: CardioPrefs; onEdit: () => void }) {
  const age = readAthleteProfile().age;
  const hrMax = effectiveHrMax(prefs, age);
  const zones = hrMax ? hrZones(hrMax.hrMax, prefs.restingHr) : [];

  return (
    <SectionCard>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <h3 style={{ ...titleStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
          <HeartPulse size={16} aria-hidden="true" style={{ color: 'var(--fs-accent-2)' }} />
          אזורי דופק
        </h3>
        <button
          type="button"
          className="cta-ghost focus-ring"
          style={{ minHeight: 44, paddingInline: 8 }}
          onClick={onEdit}
        >
          <Pencil size={14} aria-hidden="true" style={{ marginInlineEnd: 6 }} />
          עריכה
        </button>
      </div>
      {zones.length > 0 && hrMax ? (
        <>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {zones.map((z, i) => (
              <li key={z.zone} style={rowStyle}>
                <span>
                  אזור <span className="kinetic-number">{z.zone}</span> · {ZONES[i]?.name}
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--fs-muted)' }}>
                    {ZONES[i]?.hint}
                  </span>
                </span>
                <span className="kinetic-number" style={{ fontWeight: 600 }}>
                  {z.min}–{z.zone < 5 ? z.max - 1 : z.max}
                </span>
              </li>
            ))}
          </ul>
          <p style={{ ...mutedStyle, marginTop: 8 }}>
            {hrMax.measured
              ? `לפי דופק מרבי ${hrMax.hrMax} שהזנתם`
              : `לפי דופק מרבי משוער ${hrMax.hrMax} לגיל ${age} (נוסחת Tanaka). אם מדדתם דופק מרבי, הזינו אותו לדיוק.`}
            {prefs.restingHr ? ` ודופק מנוחה ${prefs.restingHr}.` : ''}
          </p>
        </>
      ) : (
        <p style={mutedStyle}>הוסיפו גיל בפרופיל או הזינו דופק מרבי, ונציג את חמשת האזורים.</p>
      )}
    </SectionCard>
  );
}
