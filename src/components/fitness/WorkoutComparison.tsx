import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type React from 'react';
import { memo, useMemo } from 'react';
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../../types';
import { setVolume } from '../../utils/workoutMath';

export interface WorkoutComparisonProps {
  current: WorkoutSession;
  previous: WorkoutSession | null;
  className?: string;
}

type DeltaTone = 'positive' | 'negative' | 'neutral';
type DeltaDir = 'up' | 'down' | 'flat';

interface TileData {
  label: string;
  currentDisplay: string;
  prevDisplay: string;
  deltaLabel: string | null;
  tone: DeltaTone;
  direction: DeltaDir;
}

interface BestSet {
  weight: number;
  reps: number;
  volume: number;
}

const fmtVol = (v: number): string => `${Math.round(v).toLocaleString('he-IL')} ק״ג`;

const fmtDuration = (sec: number): string => {
  if (sec < 3600) return `${Math.floor(sec / 60)} דק'`;
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return `${h}ש ${m}ד`;
};

const pct = (curr: number, prev: number): number | null =>
  prev === 0 ? null : ((curr - prev) / prev) * 100;

const fmtRpe = (r: number | null): string => (r === null ? '–' : r.toFixed(1));

const daysBetween = (a: string, b: string): number => {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
  return Math.max(0, Math.round(Math.abs(ta - tb) / 86400000));
};

const fmtDateDelta = (d: number): string => {
  if (d <= 0) return 'היום';
  if (d === 1) return 'לפני יום';
  if (d === 2) return 'לפני יומיים';
  return `לפני ${d} ימים`;
};

const dirFromDelta = (delta: number): DeltaDir => (delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat');

const isEffectiveSet = (s: WorkoutSet): boolean => s.isCompleted && !s.isWarmup;

const sessionVolume = (session: WorkoutSession): number => {
  let total = 0;
  for (const ex of session.exercises) {
    for (const s of ex.sets) if (isEffectiveSet(s)) total += setVolume(s);
  }
  return total;
};

const sessionAvgRpe = (session: WorkoutSession): number | null => {
  let sum = 0;
  let count = 0;
  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      if (isEffectiveSet(s) && s.rpe !== null && s.rpe !== undefined) {
        sum += s.rpe;
        count += 1;
      }
    }
  }
  return count === 0 ? null : sum / count;
};

const bestSet = (ex: WorkoutExercise): BestSet | null => {
  let best: BestSet | null = null;
  for (const s of ex.sets) {
    if (!isEffectiveSet(s)) continue;
    const volume = setVolume(s);
    if (!best || volume > best.volume) best = { weight: s.weight, reps: s.reps, volume };
  }
  return best;
};

const toneClass = (tone: DeltaTone): string =>
  tone === 'positive'
    ? 'bg-emerald-500/15 text-emerald-400'
    : tone === 'negative'
      ? 'bg-rose-500/15 text-rose-400'
      : 'bg-white/5 text-[var(--color-text-secondary)]';

interface DeltaChipProps {
  label: string | null;
  tone: DeltaTone;
  direction: DeltaDir;
}

const DeltaChip: React.FC<DeltaChipProps> = ({ label, tone, direction }) => {
  if (label === null) return null;
  const Icon = direction === 'up' ? TrendingUp : direction === 'down' ? TrendingDown : Minus;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneClass(tone)}`}
    >
      <Icon size={12} aria-hidden="true" />
      {label}
    </span>
  );
};

const WorkoutComparisonInner: React.FC<WorkoutComparisonProps> = ({
  current,
  previous,
  className,
}) => {
  const tiles = useMemo<TileData[]>(() => {
    if (!previous) return [];

    const curVol = current.totalVolume || sessionVolume(current);
    const prevVol = previous.totalVolume || sessionVolume(previous);
    const volDelta = curVol - prevVol;
    const volPct = pct(curVol, prevVol);
    const volLabel =
      volPct !== null
        ? `${volPct >= 0 ? '+' : ''}${volPct.toFixed(0)}%`
        : `${volDelta >= 0 ? '+' : ''}${fmtVol(Math.abs(volDelta))}`;

    const curDur = current.duration || 0;
    const prevDur = previous.duration || 0;
    const durDelta = curDur - prevDur;
    const durDeltaMin = Math.round(durDelta / 60);
    const durPct = pct(curDur, prevDur);
    const durTone: DeltaTone =
      durPct !== null && Math.abs(durPct) >= 30
        ? durDelta > 0
          ? 'negative'
          : 'positive'
        : 'neutral';

    const curRpe = sessionAvgRpe(current);
    const prevRpe = sessionAvgRpe(previous);
    let rpeLabel: string | null = null;
    let rpeDir: DeltaDir = 'flat';
    if (curRpe !== null && prevRpe !== null) {
      const diff = curRpe - prevRpe;
      rpeDir = diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : 'flat';
      rpeLabel = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}`;
    }

    const curEx = current.exercises.length;
    const prevEx = previous.exercises.length;
    const exDelta = curEx - prevEx;

    return [
      {
        label: 'נפח כולל',
        currentDisplay: fmtVol(curVol),
        prevDisplay: `קודם: ${fmtVol(prevVol)}`,
        deltaLabel: volLabel,
        tone: volDelta > 0 ? 'positive' : volDelta < 0 ? 'negative' : 'neutral',
        direction: dirFromDelta(volDelta),
      },
      {
        label: 'משך אימון',
        currentDisplay: fmtDuration(curDur),
        prevDisplay: `קודם: ${fmtDuration(prevDur)}`,
        deltaLabel: durDelta === 0 ? null : `${durDeltaMin >= 0 ? '+' : ''}${durDeltaMin} דק'`,
        tone: durTone,
        direction: dirFromDelta(durDelta),
      },
      {
        label: 'ממוצע RPE',
        currentDisplay: fmtRpe(curRpe),
        prevDisplay: `קודם: ${fmtRpe(prevRpe)}`,
        deltaLabel: rpeLabel,
        tone: 'neutral',
        direction: rpeDir,
      },
      {
        label: 'תרגילים',
        currentDisplay: String(curEx),
        prevDisplay: `קודם: ${prevEx}`,
        deltaLabel: exDelta === 0 ? null : `${exDelta >= 0 ? '+' : ''}${exDelta}`,
        tone: 'neutral',
        direction: dirFromDelta(exDelta),
      },
    ];
  }, [current, previous]);

  const exerciseComparisons = useMemo(() => {
    if (!previous) return [];
    const prevById = new Map<string, WorkoutExercise>();
    for (const ex of previous.exercises) prevById.set(ex.exerciseId, ex);
    return current.exercises
      .map((curEx) => {
        const prevEx = prevById.get(curEx.exerciseId);
        if (!prevEx) return null;
        const curBest = bestSet(curEx);
        const prevBest = bestSet(prevEx);
        if (!curBest && !prevBest) return null;
        return { id: curEx.id, name: curEx.exerciseName, curBest, prevBest };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [current, previous]);

  const dateDeltaLabel = useMemo(() => {
    if (!previous) return '';
    const base = previous.endTime ?? previous.startTime ?? previous.date;
    const ref = current.endTime ?? current.startTime ?? current.date;
    if (!base || !ref) return '';
    return fmtDateDelta(daysBetween(ref, base));
  }, [current, previous]);

  const containerClass = `space-y-3 ${className ?? ''}`.trim();

  if (!previous) {
    return (
      <section dir="rtl" className={containerClass} aria-label="השוואה לאימון הקודם">
        <div className="card p-3">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">השוואה לאימון הקודם</h3>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">אין אימון קודם להשוואה</p>
        </div>
      </section>
    );
  }

  return (
    <section dir="rtl" className={containerClass} aria-label="השוואה לאימון הקודם">
      <div className="card p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-text)]">השוואה לאימון הקודם</h3>
          {dateDeltaLabel && (
            <span className="text-[11px] text-[var(--color-text-secondary)]">{dateDeltaLabel}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2" role="list">
        {tiles.map((t) => (
          <div key={t.label} role="listitem" className="card p-3 flex items-start gap-2 flex-col">
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-[11px] text-[var(--color-text-secondary)]">{t.label}</span>
              <DeltaChip label={t.deltaLabel} tone={t.tone} direction={t.direction} />
            </div>
            <div className="text-lg font-bold text-[var(--color-text)] leading-none">
              {t.currentDisplay}
            </div>
            <div className="text-[11px] text-[var(--color-text-secondary)]">{t.prevDisplay}</div>
          </div>
        ))}
      </div>

      {exerciseComparisons.length > 0 && (
        <div className="card p-3">
          <h4 className="text-xs font-semibold text-[var(--color-text)] mb-1">השוואה לפי תרגיל</h4>
          <ul className="divide-y divide-[var(--color-separator)]">
            {exerciseComparisons.map((row) => {
              const curVol = row.curBest?.volume ?? 0;
              const prevVol = row.prevBest?.volume ?? 0;
              const diff = curVol - prevVol;
              const tone: DeltaTone = diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral';
              const curTxt = row.curBest ? `${row.curBest.weight} ק״ג × ${row.curBest.reps}` : '—';
              // Isolate the LTR weight×reps run (FSI…PDI) so the neutral × keeps
              // the digits in order inside the otherwise-Hebrew chip label.
              const prevTxt = row.prevBest
                ? `⁦${row.prevBest.weight} ק״ג × ${row.prevBest.reps}⁩`
                : '—';
              return (
                <li key={row.id} className="flex items-center justify-between py-2">
                  <span className="text-xs text-[var(--color-text)] truncate max-w-[45%]">
                    {row.name}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span dir="ltr" className="text-xs font-semibold text-[var(--color-text)]">
                      {curTxt}
                    </span>
                    <DeltaChip
                      label={row.prevBest ? `קודם ${prevTxt}` : null}
                      tone={tone}
                      direction={dirFromDelta(diff)}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};

export const WorkoutComparison = memo(WorkoutComparisonInner);
WorkoutComparison.displayName = 'WorkoutComparison';

export default WorkoutComparison;
