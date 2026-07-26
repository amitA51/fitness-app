// PRHistoryTab - shows all personal records grouped by exercise, sorted by
// most recent. Pulls from the IDB personal_records store via prService.getAllPRs.
//
// Fresh Steel / Obsidian: tokenized for light + dark. This used to be built
// entirely from hardcoded text-white / bg-white/* / rose classes, rendering
// white-on-bone (invisible) in the default light theme. It now uses the same
// surface/ink/error tokens as the rest of the Progress board.

import { AnimatePresence, m } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
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
  const [isOpen, setIsOpen] = useState(false);

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

  return (
    <section
      dir="rtl"
      style={{ ...cardStyle, borderColor: error ? 'var(--color-error)' : 'var(--fs-surface-2)' }}
    >
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center justify-between w-full outline-none"
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          marginBottom: isOpen ? 12 : 0,
        }}
      >
        <h3 className="text-right" style={{ ...kickerStyle, margin: 0 }}>
          היסטוריית שיאים · PR HISTORY
        </h3>
        <ChevronDown
          size={16}
          style={{
            color: 'var(--fs-muted)',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}
          >
            {loading ? (
              <p style={{ fontSize: 13, color: 'var(--fs-muted)', marginTop: 12 }}>טוען שיאים…</p>
            ) : error ? (
              <p style={{ fontSize: 13, color: 'var(--color-error)', marginTop: 12 }}>{error}</p>
            ) : grouped.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--fs-muted)', lineHeight: 1.5, marginTop: 12 }}>
                היסטוריית השיאים תופיע כאן אחרי שתתחילו לצבור אימונים ולהשלים סטים.
              </p>
            ) : (
              <ul className="space-y-2 mt-3">
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
                        style={{
                          fontSize: 10,
                          color: 'var(--fs-muted)',
                          fontFamily: 'var(--font-mono)',
                        }}
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
                            style={{
                              fontSize: 13,
                              color: 'var(--fs-ink)',
                              fontFamily: 'var(--font-mono)',
                            }}
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
            )}
          </m.div>
        )}
      </AnimatePresence>
    </section>
  );
}
