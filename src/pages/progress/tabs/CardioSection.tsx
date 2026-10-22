// ============================================================================
// CardioSection — Progress › אימונים › אירובי.
// ============================================================================
// Answers a runner's questions in order: how far this week (against a goal),
// the last 12 weeks, am I getting faster, my records, what could I race, and
// which heart-rate zone is which. Every block hides itself until there is data
// that can honestly fill it. The cards live in ./cardio/.

import { Footprints } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCardioPrefs } from '../../../services/running/cardioPrefs';
import type { WorkoutSession } from '../../../types';
import {
  bestRecentRun,
  cardioRecords,
  datedEfforts,
  runPaceTrend,
  totalsByDiscipline,
  weeklyCardio,
} from '../../../utils/cardio';
import { PaceTrend, WeeklyBars } from '../components/CardioCharts';
import { SectionCard } from '../components/SectionCard';
import { HrZonesCard } from './cardio/HrZonesCard';
import { OtherCardioCard } from './cardio/OtherCardioCard';
import { type PrefsEditing, PrefsSheet } from './cardio/PrefsSheet';
import { RaceEstimateCard } from './cardio/RaceEstimateCard';
import { RecordsCard } from './cardio/RecordsCard';
import { RunningCoachLink } from './cardio/RunningCoachLink';
import { WeekGoalCard } from './cardio/WeekGoalCard';
import { mutedStyle, titleStyle } from './cardio/styles';

export const CardioSection = memo(function CardioSection({
  sessions,
}: {
  sessions: WorkoutSession[];
}) {
  const navigate = useNavigate();
  const prefs = useCardioPrefs();
  const [editing, setEditing] = useState<PrefsEditing>(null);

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

  // Other disciplines, last 30 days.
  const others = useMemo(() => {
    const from = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return totalsByDiscipline(efforts.filter((e) => e.discipline !== 'running' && e.at >= from));
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

  return (
    <div className="space-y-4">
      {/* This week against the goal, and the way to the running coach */}
      {hasRuns && (
        <>
          <WeekGoalCard
            weekKm={thisWeek?.distanceKm ?? 0}
            goal={goal}
            onEditGoal={() => setEditing('goal')}
          />
          <RunningCoachLink />
        </>
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

      {hasRuns && (records.longest || records.fastest.size > 0) && (
        <RecordsCard records={records} />
      )}

      {best && <RaceEstimateCard best={best} />}

      <HrZonesCard prefs={prefs} onEdit={() => setEditing('hr')} />

      {others.length > 0 && <OtherCardioCard totals={others} />}

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
