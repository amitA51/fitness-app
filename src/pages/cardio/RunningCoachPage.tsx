// ============================================================================
// RunningCoachPage (/cardio/coach) — "מאמן הריצה".
// ============================================================================
// One screen answers a runner's questions in the order they come up: what do I
// run next (and how, and why), where do I stand against my goal, how is this
// week going, what are my paces — then the AI coach for anything else, and the
// tips behind it all. Every number comes from services/running via
// useRunningCoach; the AI only explains and answers.

import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/ui/PageHeader';
import { SkeletonBox } from '../../components/ui/SkeletonLoader';
import { useData } from '../../contexts/DataContext';
import { useRunningCoach } from '../../hooks/useRunningCoach';
import { runningBrief } from '../../services/ai/runningCoach';
import { isHotSeason, writeRunningGoal } from '../../services/running';
import { CoachChat } from './coach/CoachChat';
import { GoalCard } from './coach/GoalCard';
import { NextRunCard } from './coach/NextRunCard';
import { PacesCard } from './coach/PacesCard';
import { TipsSection } from './coach/TipsSection';
import { WeekCard } from './coach/WeekCard';
import { GoalSheet } from './components/GoalSheet';
import './cardio.css';
import './coach/coach.css';

/** Fewer runs than this in four weeks still reads as starting out (tips). */
const BEGINNER_RUNS_28D = 6;

function CoachSkeleton() {
  return (
    <div className="page-stack" aria-busy="true" aria-label="טוענים את הריצות שלכם">
      <SkeletonBox height={300} borderRadius="var(--radius-2xl)" />
      <SkeletonBox height={150} borderRadius="var(--radius-2xl)" />
      <SkeletonBox height={190} borderRadius="var(--radius-2xl)" />
    </div>
  );
}

export default function RunningCoachPage() {
  const navigate = useNavigate();
  const { isFirstLoad, error, refreshData } = useData();
  const [now] = useState(() => new Date());
  const coach = useRunningCoach(now);
  const [goalSheet, setGoalSheet] = useState<'edit' | 'new' | null>(null);

  const goBack = useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx;
    if (idx && idx > 0) navigate(-1);
    else navigate('/cardio');
  }, [navigate]);

  // Built at send time, so a run logged meanwhile is in the next answer.
  const getBrief = useCallback(() => runningBrief({ ...coach, now: new Date() }), [coach]);

  const isBeginner = !coach.hasRuns || coach.load.recentRuns.length < BEGINNER_RUNS_28D;

  return (
    <div style={{ background: 'var(--fs-bg)', minHeight: '100%' }} dir="rtl">
      <PageHeader title="מאמן הריצה" eyebrow="מה לרוץ, באיזה קצב, ולמה" onBack={goBack} />

      <div className="page-shell" style={{ paddingTop: 16 }}>
        {isFirstLoad ? (
          <CoachSkeleton />
        ) : (
          <div className="page-stack">
            {error && (
              <div className="rc-error" role="alert">
                <span>לא הצלחנו לטעון את כל הריצות, אז ההמלצות אולי חלקיות.</span>
                <button
                  type="button"
                  className="cta-ghost focus-ring"
                  style={{ justifySelf: 'start', paddingInline: 0, color: 'var(--fs-link)' }}
                  onClick={() => void refreshData()}
                >
                  נסו שוב
                </button>
              </div>
            )}

            <NextRunCard next={coach.next} hasRuns={coach.hasRuns} />

            <GoalCard
              goal={coach.goal}
              progress={coach.progress}
              hasReference={coach.reference !== null}
              estimateOnly={coach.reference?.confidence === 'low'}
              now={now}
              onEdit={(fresh) => setGoalSheet(fresh ? 'new' : 'edit')}
              onClear={() => writeRunningGoal(null)}
            />

            <WeekCard
              load={coach.load}
              weeklyGoalKm={coach.weeklyGoalKm}
              hasRuns={coach.hasRuns}
              now={now}
              goalRange={
                coach.progress && coach.progress.phase !== 'past' ? coach.progress.weekly : null
              }
            />

            <PacesCard
              bands={coach.bands}
              reference={coach.reference}
              hrMax={coach.hrMax}
              now={now}
            />

            <CoachChat getBrief={getBrief} subject={coach.goal?.label} />

            <TipsSection isSummer={isHotSeason(now)} isBeginner={isBeginner} />
          </div>
        )}
      </div>

      <GoalSheet
        key={goalSheet ?? 'closed'}
        isOpen={goalSheet !== null}
        onClose={() => setGoalSheet(null)}
        goal={goalSheet === 'edit' ? coach.goal : null}
      />
    </div>
  );
}
