/**
 * SparkOS Fitness — Dashboard
 * "Sport Annual" Editorial Design
 * Navy · Mustard · Bone · Big Shoulders Display + IBM Plex Mono
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChapterBreak } from '../components/dashboard/ChapterBreak';
import { Greeting } from '../components/dashboard/Greeting';
import { ImprovementScore } from '../components/dashboard/ImprovementScore';
import { RecentWorkouts } from '../components/dashboard/RecentWorkouts';
import { TemplateQuickStart, TemplateStrip } from '../components/dashboard/TemplateQuickStart';
import { WeeklyGrid } from '../components/dashboard/WeeklyGrid';
import { WeeklyStatsBlock } from '../components/dashboard/WeeklyStatsBlock';
import { StreakCalendar } from '../components/fitness/StreakCalendar';
import { useSettings } from '../contexts/SettingsContext';
import { useFitnessInsights } from '../hooks/fitness/useFitnessInsights';
import { useProgressionRecommendation } from '../hooks/fitness/useProgressionRecommendation';
import { getWorkoutTemplates } from '../services/workoutDb';
import type { WorkoutSession, WorkoutTemplate } from '../types';
import { THEMES, getWeekNumber, getWeekStart, pad2 } from '../utils/dateUtils';

export default function Dashboard() {
  const { settings, updateSettings } = useSettings();
  const currentTheme = settings.theme;
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);

  const { workoutSessions } = useFitnessInsights();

  const exercisesForProgression = useMemo(() => {
    const exerciseMap = new Map<string, { id: string; name: string }>();
    workoutSessions
      .filter((s) => s.status === 'completed')
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 20)
      .forEach((session) => {
        session.exercises?.forEach((ex) => {
          if (!exerciseMap.has(ex.exerciseId)) {
            exerciseMap.set(ex.exerciseId, {
              id: ex.exerciseId,
              name: ex.exerciseName || ex.name || 'תרגיל',
            });
          }
        });
      });
    return Array.from(exerciseMap.values()).slice(0, 10);
  }, [workoutSessions]);

  const { exerciseRecommendations } = useProgressionRecommendation(exercisesForProgression);

  useEffect(() => {
    async function load() {
      try {
        const rawTemplates = await getWorkoutTemplates();
        setTemplates(rawTemplates);
      } catch {
        // Silent fail
      }
    }
    load();
    window.addEventListener('WORKOUT_SAVED', load);
    return () => window.removeEventListener('WORKOUT_SAVED', load);
  }, []);

  const sortedTemplates = useMemo(() => {
    return [...templates.filter((t) => t.isFavorite), ...templates.filter((t) => !t.isFavorite)];
  }, [templates]);

  const lastUsedTemplate = useMemo(() => {
    const completed = [...templates].filter((t) => t.lastUsed);
    if (completed.length === 0) return null;
    completed.sort((a, b) => {
      const ta = a.lastUsed ? new Date(a.lastUsed).getTime() : 0;
      const tb = b.lastUsed ? new Date(b.lastUsed).getTime() : 0;
      return tb - ta;
    });
    return completed[0] ?? null;
  }, [templates]);

  const handleQuickStart = useCallback(() => {
    if (lastUsedTemplate) navigate(`/workout/${lastUsedTemplate.id}`);
    else navigate('/workout');
  }, [lastUsedTemplate, navigate]);

  const handleThemeChange = useCallback(() => {
    updateSettings({
      theme: THEMES[(THEMES.indexOf(currentTheme) + 1) % THEMES.length] ?? currentTheme,
    });
  }, [currentTheme, updateSettings]);

  const goToPrevWeek = useCallback(() => {
    setSelectedWeekOffset((prev) => prev - 1);
  }, []);

  const goToNextWeek = useCallback(() => {
    setSelectedWeekOffset((prev) => Math.min(prev + 1, 0));
  }, []);

  const weeklyStats = useMemo(() => {
    const currentWeekStart = getWeekStart(new Date());
    const targetWeekStart = new Date(currentWeekStart);
    targetWeekStart.setDate(targetWeekStart.getDate() + selectedWeekOffset * 7);
    const targetWeekEnd = new Date(targetWeekStart);
    targetWeekEnd.setDate(targetWeekEnd.getDate() + 7);

    const prevWeekStart = new Date(targetWeekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(targetWeekStart);

    const completed = workoutSessions.filter((s) => s.status === 'completed');

    const weekSessions = completed.filter((s) => {
      const d = new Date(s.startTime);
      return d >= targetWeekStart && d < targetWeekEnd;
    });
    const prevSessions = completed.filter((s) => {
      const d = new Date(s.startTime);
      return d >= prevWeekStart && d < prevWeekEnd;
    });

    const volume = weekSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0);
    const prevVolume = prevSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0);
    const volDeltaPct = prevVolume > 0 ? ((volume - prevVolume) / prevVolume) * 100 : 0;

    const weeklyGoal = 4;
    const workoutsThisWeek = weekSessions.length;
    const pct = Math.min(Math.round((workoutsThisWeek / weeklyGoal) * 100), 999);

    return {
      workoutsThisWeek,
      weeklyGoal,
      pct,
      volume,
      volDeltaPct,
      weekNumber: getWeekNumber(targetWeekStart),
    };
  }, [workoutSessions, selectedWeekOffset]);

  const recentWorkouts = useMemo(() => {
    return workoutSessions
      .filter((s) => s.status === 'completed')
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, 5);
  }, [workoutSessions]);

  const handleNavigate = useCallback((path: string) => navigate(path), [navigate]);

  return (
    <div className="min-h-screen pb-28" dir="rtl" style={{ background: 'var(--bone)' }}>
      <Greeting onThemeChange={handleThemeChange} weekNumber={weeklyStats.weekNumber} />

      <main style={{ padding: '24px 20px 28px' }}>
        <WeeklyStatsBlock
          workoutsThisWeek={weeklyStats.workoutsThisWeek}
          weeklyGoal={weeklyStats.weeklyGoal}
          pct={weeklyStats.pct}
          volume={weeklyStats.volume}
          volDeltaPct={weeklyStats.volDeltaPct}
          lastUsedTemplate={lastUsedTemplate}
          onQuickStart={handleQuickStart}
        />

        <TemplateQuickStart onQuickStart={handleQuickStart} />

        {lastUsedTemplate && (
          <button
            type="button"
            onClick={() => navigate('/workout')}
            className="focus-ring"
            style={{
              width: '100%',
              marginTop: 8,
              padding: '6px 0',
              background: 'transparent',
              border: 'none',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--stone)',
              cursor: 'pointer',
            }}
          >
            או התחל אימון חופשי
          </button>
        )}

        <TemplateStrip templates={sortedTemplates} onNavigate={handleNavigate} />

        <ChapterBreak
          number="§02"
          title="המלצות"
          subtitle="next up"
          style={{ marginTop: 24, marginBottom: 0 }}
        />

        {exerciseRecommendations.length > 0 ? (
          <ProgressionSection exerciseRecommendations={exerciseRecommendations} />
        ) : (
          <FallbackSkillRows sessions={workoutSessions} />
        )}

        <ChapterBreak
          number="§03"
          title="שבוע"
          subtitle={`week ${pad2(weeklyStats.weekNumber)}`}
          style={{ marginTop: 24, marginBottom: 0 }}
        />

        <div className="card-outlined">
          <WeeklyGrid
            sessions={workoutSessions}
            weekOffset={selectedWeekOffset}
            onPrevWeek={goToPrevWeek}
            onNextWeek={goToNextWeek}
          />

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--bone-deep)' }}>
            <div className="skill-top">
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  letterSpacing: '0.22em',
                  textTransform: 'uppercase',
                  color: 'var(--stone)',
                }}
              >
                יעד שבועי
              </span>
              <span className="skill-pct">
                {weeklyStats.workoutsThisWeek} / {weeklyStats.weeklyGoal}
              </span>
            </div>
            <div className="skill-bar" style={{ marginTop: 10 }}>
              <div
                className="skill-fill"
                style={{
                  width: `${Math.min(
                    (weeklyStats.workoutsThisWeek / weeklyStats.weeklyGoal) * 100,
                    100
                  )}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <ImprovementScore sessions={workoutSessions} />
        </div>

        <div className="card-outlined" style={{ marginTop: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>
            § streak · 30d
          </div>
          <StreakCalendar sessions={workoutSessions} days={30} />
        </div>

        <ChapterBreak
          number="§04"
          title="היסטוריה"
          subtitle="recent"
          style={{ marginTop: 24, marginBottom: 16 }}
        />

        <RecentWorkouts sessions={recentWorkouts} />

        {recentWorkouts.length > 0 && (
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button
              type="button"
              onClick={() => navigate('/history')}
              className="btn-primary focus-ring"
            >
              היסטוריה מלאה
            </button>
            <button
              type="button"
              onClick={() => navigate('/history')}
              className="btn-secondary focus-ring"
            >
              יומן
            </button>
          </div>
        )}

        <div style={{ height: 24 }} />
      </main>
    </div>
  );
}

// ── ProgressionSection — skill-rows ──────────────────────────────────────────
function ProgressionSection({
  exerciseRecommendations,
}: {
  exerciseRecommendations: ReturnType<
    typeof useProgressionRecommendation
  >['exerciseRecommendations'];
}) {
  if (exerciseRecommendations.length === 0) return null;

  const weight = (r: (typeof exerciseRecommendations)[number]) => {
    if (r.recommendation === 'INCREASE_WEIGHT' || r.recommendation === 'INCREASE_REPS') return 0;
    if (r.recommendation === 'MAINTAIN') return 1;
    return 2;
  };

  const sorted = [...exerciseRecommendations].sort((a, b) => weight(a) - weight(b)).slice(0, 4);

  return (
    <div className="card-outlined" style={{ padding: '4px 20px' }}>
      {sorted.map((r) => {
        let pct = Math.max(10, Math.min(100, Math.round(r.confidence || 0)));
        if (r.recommendation === 'INCREASE_WEIGHT' || r.recommendation === 'INCREASE_REPS') {
          pct = Math.max(pct, 80);
        } else if (r.recommendation === 'DECREASE_WEIGHT' || r.recommendation === 'DELOAD') {
          pct = Math.min(pct, 35);
        }

        const target =
          r.recommendation === 'MAINTAIN'
            ? `${r.currentWeight} ק״ג`
            : `${r.currentWeight} → ${r.suggestedWeight} ק״ג`;

        return (
          <div key={r.exerciseId} className="skill-row">
            <div className="skill-top">
              <span className="skill-name line-clamp-1">{r.exerciseName}</span>
              <span className="skill-pct">{target}</span>
            </div>
            <div className="skill-bar">
              <div className="skill-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── FallbackSkillRows — when no recommendations, show top exercises ──────────
function FallbackSkillRows({ sessions }: { sessions: WorkoutSession[] }) {
  const topExercises = useMemo(() => {
    const countMap = new Map<string, { name: string; count: number; volume: number }>();
    sessions
      .filter((s) => s.status === 'completed')
      .slice(0, 20)
      .forEach((s) => {
        s.exercises?.forEach((ex) => {
          const name = ex.exerciseName || ex.name || 'תרגיל';
          const key = ex.exerciseId || name;
          const entry = countMap.get(key) || { name, count: 0, volume: 0 };
          entry.count += 1;
          entry.volume += (ex.sets || []).reduce(
            (sum, set) => sum + (set.weight || 0) * (set.reps || 0),
            0
          );
          countMap.set(key, entry);
        });
      });
    const arr = Array.from(countMap.values()).sort((a, b) => b.count - a.count);
    const max = arr[0]?.count || 1;
    return arr.slice(0, 4).map((e) => ({ ...e, pct: Math.round((e.count / max) * 100) }));
  }, [sessions]);

  if (topExercises.length === 0) return null;

  return (
    <div className="card-outlined" style={{ padding: '4px 20px' }}>
      {topExercises.map((e) => (
        <div key={e.name} className="skill-row">
          <div className="skill-top">
            <span className="skill-name line-clamp-1">{e.name}</span>
            <span className="skill-pct">{e.count}×</span>
          </div>
          <div className="skill-bar">
            <div className="skill-fill" style={{ width: `${e.pct}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
