// ============================================================================
// CardioSection — Progress › אימונים › אירובי.
// ============================================================================
// Answers a runner's questions in order: how far this week (against a goal),
// the last 12 weeks, am I getting faster, my records, what could I race, and
// which heart-rate zone is which. Every block hides itself until there is data
// that can honestly fill it.

import { ChevronLeft, Footprints, HeartPulse, Pencil, Trophy } from 'lucide-react';
import { memo, useId, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet } from '../../../components/ui/Sheet';
import { readAthleteProfile } from '../../../services/intelligence/profile';
import type { WorkoutSession } from '../../../types';
import {
  RECORD_DISTANCES,
  UNIT_KM,
  bestRecentRun,
  cardioRecords,
  datedEfforts,
  formatClock,
  formatKm,
  hrZones,
  parseDecimal,
  predictRaceSec,
  runPaceTrend,
  weeklyCardio,
} from '../../../utils/cardio';
import { formatHebrewDate } from '../../../utils/dateUtils';
import {
  type CardioPrefs,
  effectiveHrMax,
  useCardioPrefs,
  writeCardioPrefs,
} from '../../cardio/cardioPrefs';
import { PaceTrend, WeeklyBars } from '../components/CardioCharts';
import { SectionCard } from '../components/SectionCard';

const ZONES = [
  { name: 'התאוששות', hint: 'הליכה, חימום' },
  { name: 'קל', hint: 'אפשר לנהל שיחה' },
  { name: 'בינוני', hint: 'מדברים במשפטים קצרים' },
  { name: 'מאומץ', hint: 'טמפו, קשה לדבר' },
  { name: 'מקסימלי', hint: 'ספרינטים קצרים' },
] as const;

const RACE_TARGETS = [
  { km: 5, label: '5 ק״מ' },
  { km: 10, label: '10 ק״מ' },
  { km: 21.0975, label: 'חצי מרתון' },
] as const;

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minHeight: 48,
  padding: '8px 0',
  borderBottom: '1px solid var(--fs-surface-2)',
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  color: 'var(--fs-ink)',
} as const;

const titleStyle = {
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--fs-heading)',
} as const;

const mutedStyle = {
  margin: 0,
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--fs-muted)',
} as const;

export const CardioSection = memo(function CardioSection({
  sessions,
}: {
  sessions: WorkoutSession[];
}) {
  const navigate = useNavigate();
  const prefs = useCardioPrefs();
  const [editing, setEditing] = useState<'goal' | 'hr' | null>(null);

  const efforts = useMemo(() => datedEfforts(sessions), [sessions]);
  const runs = useMemo(() => efforts.filter((e) => e.discipline === 'running'), [efforts]);
  const hasRuns = runs.length > 0;
  const hasDistance = efforts.some((e) => e.distanceKm > 0);
  // 12 weeks, minus the empty ones before the first effort (a week before
  // someone started is not a week they skipped) — but never fewer than 4.
  const weeks = useMemo(() => {
    const all = weeklyCardio(sessions, 12, new Date(), hasRuns ? 'running' : undefined);
    const first = all.findIndex((w) => w.count > 0);
    return first <= 0 ? all : all.slice(Math.min(first, all.length - 4));
  }, [sessions, hasRuns]);
  const thisWeek = weeks[weeks.length - 1];
  const paces = useMemo(() => runPaceTrend(sessions), [sessions]);
  const records = useMemo(() => cardioRecords(sessions), [sessions]);
  const best = useMemo(() => bestRecentRun(sessions), [sessions]);
  const age = readAthleteProfile().age;
  const hrMax = effectiveHrMax(prefs, age);
  const zones = hrMax ? hrZones(hrMax.hrMax, prefs.restingHr) : [];

  // Other disciplines, last 30 days.
  const others = useMemo(() => {
    const from = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const totals = new Map<string, { km: number; sec: number; count: number }>();
    for (const e of efforts) {
      if (e.discipline === 'running' || e.at < from) continue;
      const t = totals.get(e.discipline) ?? { km: 0, sec: 0, count: 0 };
      totals.set(e.discipline, {
        km: t.km + e.distanceKm,
        sec: t.sec + e.durationSec,
        count: t.count + 1,
      });
    }
    return totals;
  }, [efforts]);

  if (efforts.length === 0) {
    return (
      <SectionCard rail={false}>
        <div className="flex flex-col items-center py-10 text-center gap-3">
          <Footprints size={36} style={{ color: 'var(--fs-accent)' }} aria-hidden="true" />
          <div style={{ display: 'grid', gap: 8, maxWidth: 290 }}>
            <p style={{ ...titleStyle, fontSize: 18 }}>עוד אין ריצות או אירובי</p>
            <p style={{ ...mutedStyle, fontSize: 14 }}>
              ריצות, הליכות, רכיבות ואימוני מכשיר יופיעו כאן עם קילומטרים, קצב ושיאים.
            </p>
          </div>
          <button
            type="button"
            className="start-workout-btn focus-ring"
            style={{ width: 'auto', paddingInline: 24, minHeight: 48 }}
            onClick={() => navigate('/cardio')}
          >
            ריצה ואירובי
          </button>
        </div>
      </SectionCard>
    );
  }

  const goal = prefs.weeklyGoalKm;
  const weekKm = thisWeek?.distanceKm ?? 0;

  return (
    <div className="space-y-4">
      {/* This week against the goal */}
      {hasRuns && (
        <SectionCard>
          <div style={{ display: 'grid', gap: 10 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <h3 style={titleStyle}>ריצה השבוע</h3>
              <button
                type="button"
                className="cta-ghost focus-ring"
                style={{ minHeight: 44, paddingInline: 8 }}
                onClick={() => setEditing('goal')}
              >
                <Pencil size={14} aria-hidden="true" style={{ marginInlineEnd: 6 }} />
                {goal ? 'שינוי יעד' : 'הגדרת יעד'}
              </button>
            </div>
            <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span
                className="kinetic-number"
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 40,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: 'var(--fs-ink)',
                }}
              >
                {formatKm(weekKm)}
              </span>
              {goal && (
                <span
                  className="kinetic-number"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 18,
                    color: 'var(--fs-muted)',
                  }}
                >
                  / {formatKm(goal)}
                </span>
              )}
              <span
                style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--fs-muted)' }}
              >
                {UNIT_KM}
              </span>
            </p>
            {goal ? (
              <>
                <span
                  aria-hidden="true"
                  style={{
                    display: 'flex',
                    height: 8,
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--fs-surface-2)',
                    overflow: 'hidden',
                  }}
                >
                  <span
                    style={{
                      width: `${Math.min(100, Math.round((weekKm / goal) * 100))}%`,
                      background: 'var(--fs-accent)',
                      borderRadius: 'inherit',
                    }}
                  />
                </span>
                <p style={mutedStyle}>
                  {weekKm >= goal ? (
                    'עמדתם ביעד השבועי.'
                  ) : (
                    <>
                      נשארו <span className="kinetic-number">{formatKm(goal - weekKm)}</span>{' '}
                      {UNIT_KM} ליעד.
                    </>
                  )}
                </p>
              </>
            ) : (
              <p style={mutedStyle}>יעד שבועי עוזר להתמיד. הגדילו אותו בהדרגה.</p>
            )}
          </div>
        </SectionCard>
      )}

      {/* Last 12 weeks */}
      <SectionCard>
        <WeeklyBars
          weeks={weeks}
          measure={hasDistance ? 'km' : 'min'}
          goalKm={hasRuns ? goal : null}
          title={
            hasRuns
              ? 'קילומטרים ריצה בשבוע'
              : hasDistance
                ? 'קילומטרים אירובי בשבוע'
                : 'דקות אירובי בשבוע'
          }
        />
      </SectionCard>

      {/* Getting faster? */}
      {paces.length >= 3 && (
        <SectionCard>
          <PaceTrend points={paces} />
        </SectionCard>
      )}

      {/* Records */}
      {hasRuns && (records.longest || records.fastest.size > 0) && (
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
                      <ChevronLeft
                        size={16}
                        aria-hidden="true"
                        style={{ color: 'var(--fs-muted)' }}
                      />
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
                    <ChevronLeft
                      size={16}
                      aria-hidden="true"
                      style={{ color: 'var(--fs-muted)' }}
                    />
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
      )}

      {/* Race estimate */}
      {best && (
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
      )}

      {/* Heart-rate zones */}
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
            onClick={() => setEditing('hr')}
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

      {/* Other disciplines */}
      {others.size > 0 && (
        <SectionCard>
          <h3 style={{ ...titleStyle, marginBottom: 6 }}>אירובי נוסף ב־30 הימים האחרונים</h3>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {[...others.entries()].map(([discipline, t]) => (
              <li key={discipline} style={rowStyle}>
                <span>{DISCIPLINE_LABEL[discipline] ?? 'אחר'}</span>
                <span>
                  {t.km > 0 && (
                    <>
                      <span className="kinetic-number">{formatKm(t.km)}</span> {UNIT_KM} ·{' '}
                    </>
                  )}
                  <span className="kinetic-number">{formatClock(t.sec)}</span>
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {/* Keyed per opening so the fields start from the saved values each time. */}
      <PrefsSheet
        key={editing ?? 'closed'}
        editing={editing}
        prefs={prefs}
        onClose={() => setEditing(null)}
      />
    </div>
  );
});

const DISCIPLINE_LABEL: Record<string, string> = {
  walking: 'הליכה',
  cycling: 'רכיבה',
  rowing: 'חתירה',
  swimming: 'שחייה',
  other: 'מכשירים ואחר',
};

function PrefsSheet({
  editing,
  prefs,
  onClose,
}: {
  editing: 'goal' | 'hr' | null;
  prefs: CardioPrefs;
  onClose: () => void;
}) {
  const uid = useId();
  const [goal, setGoal] = useState(prefs.weeklyGoalKm ? String(prefs.weeklyGoalKm) : '');
  const [maxHr, setMaxHr] = useState(prefs.maxHr ? String(prefs.maxHr) : '');
  const [restHr, setRestHr] = useState(prefs.restingHr ? String(prefs.restingHr) : '');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    if (editing === 'goal') {
      const g = parseDecimal(goal);
      if (goal.trim() !== '' && (g === null || g > 500)) {
        setError('יעד בין 1 ל־500 ק״מ');
        return;
      }
      writeCardioPrefs({ ...prefs, weeklyGoalKm: g });
    } else {
      const m = parseDecimal(maxHr);
      const r = parseDecimal(restHr);
      if (maxHr.trim() !== '' && (m === null || m < 100 || m > 230)) {
        setError('דופק מרבי בין 100 ל־230');
        return;
      }
      if (restHr.trim() !== '' && (r === null || r < 30 || r > 120)) {
        setError('דופק מנוחה בין 30 ל־120');
        return;
      }
      writeCardioPrefs({
        ...prefs,
        maxHr: m ? Math.round(m) : null,
        restingHr: r ? Math.round(r) : null,
      });
    }
    setError(null);
    onClose();
  };

  const field = (
    id: string,
    label: string,
    value: string,
    set: (v: string) => void,
    unit: string
  ) => (
    <div style={{ display: 'grid', gap: 6 }}>
      <label
        htmlFor={id}
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--fs-ink)',
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }} dir="ltr">
        <input
          id={id}
          className={`input${error ? ' input-error' : ''}`}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => set(e.target.value.replace(/[^\d.,]/g, ''))}
          style={{ paddingInlineEnd: 64 }}
        />
        <span
          style={{
            position: 'absolute',
            insetInlineEnd: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--fs-muted)',
          }}
        >
          {unit}
        </span>
      </div>
    </div>
  );

  return (
    <Sheet
      isOpen={editing !== null}
      onClose={onClose}
      title={editing === 'goal' ? 'יעד ריצה שבועי' : 'אזורי דופק'}
      footer={
        <button type="button" className="start-workout-btn focus-ring" onClick={save}>
          שמירה
        </button>
      }
    >
      <div style={{ display: 'grid', gap: 16 }}>
        {editing === 'goal' ? (
          <>
            {field(`${uid}-goal`, 'כמה קילומטרים בשבוע?', goal, setGoal, UNIT_KM)}
            <p style={mutedStyle}>השאירו ריק כדי לבטל את היעד.</p>
          </>
        ) : (
          <>
            {field(`${uid}-max`, 'דופק מרבי (לא חובה)', maxHr, setMaxHr, 'bpm')}
            {field(`${uid}-rest`, 'דופק מנוחה (לא חובה)', restHr, setRestHr, 'bpm')}
            <p style={mutedStyle}>
              בלי דופק מרבי נחשב אותו לפי הגיל. עם דופק מנוחה האזורים מחושבים לפי עתודת הדופק
              (Karvonen), שמתאימה יותר למתאמנים.
            </p>
          </>
        )}
        {error && (
          <p
            role="alert"
            style={{
              margin: 0,
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-error)',
            }}
          >
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
