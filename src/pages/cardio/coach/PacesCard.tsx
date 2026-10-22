// "הקצבים שלכם" — the five personal pace bands, where they come from, and the
// easy heart-rate ceiling.

import type { PaceBand, PaceBandId, PaceReference } from '../../../services/running';
import { UNIT_KM, formatClock, formatKm } from '../../../utils/cardio';
import { EASY_HR_TOP, hebrewDayMonth, paceRangeText } from './coachFormat';

/** A few plain words per band, so no name is jargon. */
const BAND_HINTS: Readonly<Record<PaceBandId, string>> = {
  easy: 'אפשר לדבר במשפטים מלאים',
  marathon: 'נוח, אבל צריך להתרכז',
  threshold: 'קשה ונוח: רק כמה מילים',
  interval: 'קטעים של 3 עד 5 דקות',
  repetition: 'קטעים קצרים ומהירים',
};

interface PacesCardProps {
  bands: readonly PaceBand[] | null;
  reference: PaceReference | null;
  hrMax: { hrMax: number; measured: boolean } | null;
  now: Date;
}

export function PacesCard({ bands, reference, hrMax, now }: PacesCardProps) {
  return (
    <section className="rc-card" aria-labelledby="rc-paces-h">
      <h2 id="rc-paces-h" className="rc-title">
        הקצבים שלכם
      </h2>

      {bands && reference ? (
        <>
          <ul className="rc-rows">
            {bands.map((band) => (
              <li key={band.id} className="rc-row">
                <span className="rc-row-label">
                  <span style={{ fontWeight: 600 }}>{band.label}</span>
                  <span className="rc-row-hint">{BAND_HINTS[band.id]}</span>
                </span>
                <span className="rc-row-value kinetic-number" dir="ltr">
                  {paceRangeText(band.fastSec, band.slowSec)}
                </span>
              </li>
            ))}
          </ul>
          <p className="rc-muted">
            הקצבים בדקות לק״מ, לפי הריצה של{' '}
            <span className="kinetic-number">{formatKm(reference.distanceKm)}</span> {UNIT_KM} ב-
            <span className="kinetic-number" dir="ltr">
              {formatClock(reference.durationSec)}
            </span>{' '}
            ({hebrewDayMonth(reference.date, now)})
            {Math.abs(reference.distanceKm - 5) > 0.2 && (
              <>
                {' '}
                — שווה ערך ל-5 ק״מ ב-
                <span className="kinetic-number" dir="ltr">
                  {formatClock(reference.fiveKSec)}
                </span>
              </>
            )}
            .{' '}
            {reference.confidence === 'high'
              ? 'ריצה מהירה יותר תעדכן אותם.'
              : 'זו הייתה ריצה רגילה ולא מאמץ מלא, ולכן הקצבים הם הערכה ראשונית. ריצת מבחן של 5 ק״מ במאמץ מלא (או ריצה שסומנה כמרוץ) תדייק אותם.'}
          </p>
        </>
      ) : (
        <p className="rc-body">
          הקצבים האישיים יופיעו אחרי ריצה של 3 ק״מ ומעלה (מ-90 הימים האחרונים). רוצו או רשמו ריצה
          כזאת, ונחשב מתוכה קצב לריצה קלה, לטמפו ולאינטרוולים.
        </p>
      )}

      {hrMax && (
        <p className="rc-muted" style={{ fontSize: 14 }}>
          ריצה קלה: דופק עד{' '}
          <span className="kinetic-number" style={{ fontWeight: 700, color: 'var(--fs-ink)' }}>
            {Math.round(hrMax.hrMax * EASY_HR_TOP)}
          </span>
          {hrMax.measured ? '.' : ' (לפי הגיל — הערכה שעלולה לטעות ב-10 פעימות לכל כיוון).'}
        </p>
      )}
    </section>
  );
}
