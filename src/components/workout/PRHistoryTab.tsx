// PRHistoryTab - shows all personal records grouped by exercise, sorted by
// most recent. Pulls from the IDB personal_records store via prService.getAllPRs.
//
// Fresh Steel / Obsidian: tokenized for light + dark. This used to be built
// entirely from hardcoded text-white / bg-white/* / rose classes, rendering
// white-on-bone (invisible) in the default light theme. It now uses the same
// surface/ink/error tokens as the rest of the Progress board.

import type React from 'react';
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

// Shared mono kicker — matches the StrengthSection card headers.
const kickerStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.15em',
  color: 'var(--fs-muted)',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--fs-surface)',
  borderRadius: 'var(--radius-asymmetric)',
  border: '1px solid var(--fs-surface-2)',
  boxShadow: 'var(--shadow-card)',
  padding: 16,
  position: 'relative',
  overflow: 'hidden',
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
      <section dir="rtl" className="text-right" style={cardStyle}>
        <h3 style={{ ...kickerStyle, marginBottom: 8 }}>היסטוריית שיאים · PR HISTORY</h3>
        <p style={{ fontSize: 13, color: 'var(--fs-muted)' }}>טוען שיאים…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section
        dir="rtl"
        className="text-right"
        style={{ ...cardStyle, borderColor: 'var(--color-error)' }}
        role="alert"
      >
        <h3 style={{ ...kickerStyle, marginBottom: 8 }}>היסטוריית שיאים · PR HISTORY</h3>
        <p style={{ fontSize: 13, color: 'var(--color-error)' }}>{error}</p>
      </section>
    );
  }

  if (grouped.length === 0) {
    return (
      <section dir="rtl" className="text-right" style={cardStyle}>
        <h3 style={{ ...kickerStyle, marginBottom: 8 }}>היסטוריית שיאים · PR HISTORY</h3>
        <p style={{ fontSize: 13, color: 'var(--fs-muted)', lineHeight: 1.5 }}>
          היסטוריית השיאים תופיע כאן אחרי שתתחילו לצבור אימונים ולהשלים סטים.
        </p>
      </section>
    );
  }

  return (
    <section dir="rtl" style={cardStyle}>
      <h3 className="text-right" style={{ ...kickerStyle, marginBottom: 12 }}>
        היסטוריית שיאים · PR HISTORY
      </h3>
      <ul className="space-y-2">
        {grouped.map((g) => (
          <li
            key={g.exerciseName}
            style={{
              borderRadius: 12,
              background: 'var(--fs-surface-2)',
              border: '1px solid var(--fs-surface-2)',
              padding: 12,
            }}
          >
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fs-ink)' }}>
                {g.exerciseName}
              </span>
              <span
                dir="ltr"
                style={{ fontSize: 10, color: 'var(--fs-muted)', fontFamily: 'var(--font-mono)' }}
              >
                {formatDate(g.latest.date)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {g.records.slice(0, 3).map((pr) => (
                <div
                  key={pr.id}
                  className="text-right"
                  style={{
                    background: 'var(--fs-surface)',
                    borderRadius: 8,
                    padding: 8,
                    borderInlineStart: '2px solid var(--fs-accent)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      letterSpacing: '-0.01em',
                      color: 'var(--fs-muted)',
                      fontFamily: 'var(--font-mono)',
                      marginBottom: 4,
                    }}
                  >
                    {TYPE_LABEL[pr.type] || pr.type}
                  </div>
                  <div
                    dir="ltr"
                    style={{ fontSize: 13, color: 'var(--fs-ink)', fontFamily: 'var(--font-mono)' }}
                  >
                    {pr.weight} × {pr.reps}
                  </div>
                  {(() => {
                    const oneRM = pr.oneRepMax ?? 0;
                    if (oneRM <= 0) return null;
                    return (
                      <div
                        dir="ltr"
                        style={{
                          fontSize: 10,
                          color: 'var(--fs-muted)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        e1RM {Math.round(oneRM)}
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
