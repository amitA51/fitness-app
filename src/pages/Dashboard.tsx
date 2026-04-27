/**
 * SparkOS Fitness — Dashboard
 * SparkOS Fitness — Training Log Design
 * Deep green · Volt · Chalk · Big Shoulders Display + IBM Plex Mono
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { RecentPRBanner } from '../components/dashboard/RecentPRBanner';
import { RecentWorkouts } from '../components/dashboard/RecentWorkouts';
import { TemplateQuickStart, TemplateStrip } from '../components/dashboard/TemplateQuickStart';
import { WeeklyGrid } from '../components/dashboard/WeeklyGrid';
import { WeeklyStatsBlock } from '../components/dashboard/WeeklyStatsBlock';
import { useData } from '../contexts/DataContext';
import { useFitnessInsights } from '../hooks/fitness/useFitnessInsights';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { getWorkoutTemplates } from '../services/workoutDb';
import type { WorkoutTemplate } from '../types';
import { getWeekNumber, getWeekStart } from '../utils/dateUtils';
import { logger } from '../utils/logger';

export default function Dashboard() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);

  const { sessions: dataContextSessions, refreshData, loading: dataLoading } = useData();
  const { workoutSessions } = useFitnessInsights(dataContextSessions);

  const { isPulling, isRefreshing, pullDistance, threshold, handlers } = usePullToRefresh({
    onRefresh: async () => {
      await Promise.all([
        refreshData(),
        getWorkoutTemplates()
          .then(setTemplates)
          .catch((err) => logger.workout.warn('Failed to refresh templates', err)),
      ]);
    },
    threshold: 80,
  });

  useEffect(() => {
    async function load() {
      try {
        const rawTemplates = await getWorkoutTemplates();
        setTemplates(rawTemplates);
      } catch (err) {
        logger.workout.warn('Failed to load templates on dashboard', err);
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

  const monthlyStats = useMemo(() => {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 86400000;
    const completed = workoutSessions.filter(
      (s) => s.status === 'completed' && new Date(s.startTime).getTime() >= thirtyDaysAgo
    );
    const sessionCount = completed.length;
    const volume = completed.reduce((sum, s) => sum + (s.totalVolume || 0), 0);
    const avgDurationMin =
      sessionCount > 0
        ? Math.round(completed.reduce((sum, s) => sum + (s.duration || 0), 0) / sessionCount / 60)
        : 0;
    return { sessionCount, volume, avgDurationMin };
  }, [workoutSessions]);

  const handleNavigate = useCallback((path: string) => navigate(path), [navigate]);

  return (
    <div
      className="pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))]"
      dir="rtl"
      style={{
        background: 'var(--bone)',
        touchAction: 'pan-y',
        WebkitOverflowScrolling: 'touch',
      }}
      {...handlers}
    >
      {/* Pull-to-refresh indicator */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          height: pullDistance > 0 ? Math.min(pullDistance, threshold * 1.5) : 0,
          overflow: 'hidden',
          transition: isPulling && !isRefreshing ? 'none' : 'height 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            width: pullDistance > threshold ? 28 : 20,
            height: pullDistance > threshold ? 28 : 20,
            border: '2px solid var(--navy)',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: isRefreshing ? 'spin 0.7s linear infinite' : 'none',
            opacity: isRefreshing
              ? 1
              : pullDistance > 20
                ? Math.min(pullDistance / threshold, 1)
                : 0,
            transition: 'width 0.2s, height 0.2s, opacity 0.2s',
          }}
        />
      </div>

      <DashboardHeader weekNumber={weeklyStats.weekNumber} />

      <main style={{ padding: '24px 20px 28px' }}>
        {/* 1. Weekly Stats — most important CTA */}
        <WeeklyStatsBlock
          workoutsThisWeek={weeklyStats.workoutsThisWeek}
          weeklyGoal={weeklyStats.weeklyGoal}
          pct={weeklyStats.pct}
          volume={weeklyStats.volume}
          volDeltaPct={weeklyStats.volDeltaPct}
          lastUsedTemplate={lastUsedTemplate}
          onQuickStart={handleQuickStart}
        />

        {/* 2. Quick start + Template favorites */}
        <TemplateQuickStart onQuickStart={handleQuickStart} />
        <TemplateStrip templates={sortedTemplates} onNavigate={handleNavigate} />

        {/* 3. This week calendar */}
        <div className="card-outlined" style={{ marginTop: 24 }}>
          <WeeklyGrid
            sessions={workoutSessions}
            weekOffset={selectedWeekOffset}
            onPrevWeek={goToPrevWeek}
            onNextWeek={goToNextWeek}
          />
          <MonthlyStatsRow stats={monthlyStats} />
        </div>

        {/* 4. Recent workouts — quick access */}
        <div style={{ marginTop: 24 }}>
          <RecentWorkouts sessions={workoutSessions} loading={dataLoading} />
        </div>

        {/* 5. PR highlights — factual data */}
        <RecentPRBanner />

        <div style={{ height: 24 }} />
      </main>
    </div>
  );
}

// ── MonthlyStatsRow — compact 30-day context row ─────────────────────────────
function MonthlyStatsRow({
  stats,
}: {
  stats: { sessionCount: number; volume: number; avgDurationMin: number };
}) {
  const volumeLabel =
    Math.round(stats.volume) >= 1000
      ? Math.round(stats.volume).toLocaleString('en-US')
      : String(Math.round(stats.volume));

  const cols: Array<{ val: string; lbl: string }> = [
    { val: String(stats.sessionCount), lbl: '30d sessions' },
    { val: volumeLabel || '—', lbl: 'kg · 30d' },
    { val: stats.avgDurationMin > 0 ? String(stats.avgDurationMin) : '—', lbl: 'min · avg' },
  ];

  return (
    <div
      style={{
        marginTop: 16,
        paddingTop: 14,
        borderTop: '1px solid var(--bone-deep)',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 12,
      }}
    >
      {cols.map((c) => (
        <div key={c.lbl}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 24,
              lineHeight: 1,
              color: 'var(--navy)',
              letterSpacing: '-0.01em',
            }}
          >
            {c.val}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--stone)',
              marginTop: 4,
            }}
          >
            {c.lbl}
          </div>
        </div>
      ))}
    </div>
  );
}
