// PRHistoryTab - shows all personal records grouped by exercise, sorted by
// most recent. Pulls from the IDB personal_records store via prService.getAllPRs.

import { useEffect, useMemo, useState } from 'react';
import { type PersonalRecord, getAllPRs } from '../../services/prService';
import { logger } from '../../utils/logger';

interface GroupedPRs {
  exerciseName: string;
  records: PersonalRecord[];
  latest: PersonalRecord;
}

const TYPE_LABEL: Record<string, string> = {
  weight: 'משקל',
  volume: 'נפח',
  reps: 'חזרות',
  '1rm': '1RM',
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

function groupByExercise(prs: PersonalRecord[]): GroupedPRs[] {
  const map = new Map<string, PersonalRecord[]>();
  for (const pr of prs) {
    const key = pr.exerciseName || pr.exerciseId || 'לא ידוע';
    const arr = map.get(key) ?? [];
    arr.push(pr);
    map.set(key, arr);
  }
  const groups: GroupedPRs[] = [];
  for (const [exerciseName, records] of map) {
    records.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const latest = records[0];
    if (latest) groups.push({ exerciseName, records, latest });
  }
  groups.sort((a, b) => (b.latest.date || '').localeCompare(a.latest.date || ''));
  return groups;
}

export default function PRHistoryTab() {
  const [prs, setPRs] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await getAllPRs();
        if (!cancelled) {
          setPRs(all);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          logger.workout?.error?.('PRHistoryTab: getAllPRs failed', err);
          setError('שגיאה בטעינת שיאים');
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => groupByExercise(prs), [prs]);

  if (loading) {
    return (
      <section
        dir="rtl"
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-right"
      >
        <h3 className="text-base font-semibold text-white mb-2">שיאים אישיים</h3>
        <p className="text-sm text-white/60">טוען שיאים…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section dir="rtl" className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-4">
        <h3 className="text-base font-semibold text-white mb-2">שיאים אישיים</h3>
        <p className="text-sm text-rose-200">{error}</p>
      </section>
    );
  }

  if (grouped.length === 0) {
    return (
      <section
        dir="rtl"
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-right"
      >
        <h3 className="text-base font-semibold text-white mb-2">שיאים אישיים</h3>
        <p className="text-sm text-white/60">
          היסטוריית השיאים תופיע כאן אחרי שתתחיל לצבור אימונים ולהשלים סטים.
        </p>
      </section>
    );
  }

  return (
    <section dir="rtl" className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <h3 className="text-base font-semibold text-white mb-3 text-right">שיאים אישיים</h3>
      <ul className="space-y-2">
        {grouped.map((g) => (
          <li
            key={g.exerciseName}
            className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3"
          >
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <span className="text-sm font-semibold text-white">{g.exerciseName}</span>
              <span className="text-[10px] text-white/40 font-mono">
                {formatDate(g.latest.date)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {g.records.slice(0, 3).map((pr) => (
                <div
                  key={pr.id}
                  className="bg-white/[0.04] rounded-lg p-2 text-right"
                  style={{ borderInlineStart: '2px solid var(--fs-accent)' }}
                >
                  <div className="text-[9px] uppercase tracking-wider text-white/40 font-mono mb-1">
                    {TYPE_LABEL[pr.type] || pr.type}
                  </div>
                  <div className="text-sm text-white font-mono" style={{ direction: 'ltr' }}>
                    {pr.weight} × {pr.reps}
                  </div>
                  {(pr.oneRepMax ?? 0) > 0 && (
                    <div
                      className="text-[10px] text-white/50 font-mono"
                      style={{ direction: 'ltr' }}
                    >
                      e1RM {Math.round(pr.oneRepMax ?? 0)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
