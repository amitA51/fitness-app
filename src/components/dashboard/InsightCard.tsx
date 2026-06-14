// ============================================================================
// InsightCard — one compact, locally-computed insight on the dashboard.
// ============================================================================
// Fresh Steel / Obsidian. Renders the single insight chosen by
// pickDashboardInsight (progression → neglected muscle → streak). Pure math
// from useFitnessInsights — no AI calls on dashboard load. Numbers render
// dir="ltr" inside the RTL layout; entrance respects prefers-reduced-motion
// via FadeIn.

import { Activity, CalendarCheck, CalendarClock, Flame, TrendingUp } from 'lucide-react';
import { type ReactNode, memo } from 'react';
import { translateMuscle } from '../../constants/muscleNames';
import { FadeIn } from '../motion/FadeIn';
import type { DashboardInsight } from './insightPicker';

interface InsightCardProps {
  insight: DashboardInsight | null;
}

/** Drop a "|equipment" suffix from catalog exercise names for display. */
const displayExerciseName = (raw: string): string => raw.split('|')[0]?.trim() || raw;

export const InsightCard = memo(function InsightCard({ insight }: InsightCardProps) {
  if (!insight) return null;

  let icon: ReactNode;
  let headline: ReactNode;
  let sub: string;

  switch (insight.kind) {
    case 'progression':
      icon = <TrendingUp size={18} aria-hidden="true" style={{ color: 'var(--fs-accent)' }} />;
      headline = (
        <>
          <bdi>{displayExerciseName(insight.exerciseName)}</bdi> בעלייה:{' '}
          <span className="kinetic-number" dir="ltr">
            +{insight.changePct}%
          </span>{' '}
          נפח
        </>
      );
      sub = 'לעומת השבוע שעבר';
      break;
    case 'neglected':
      icon = <CalendarClock size={18} aria-hidden="true" style={{ color: 'var(--fs-warn)' }} />;
      headline = (
        <>
          <span className="kinetic-number" dir="ltr">
            {insight.daysSince}
          </span>{' '}
          ימים בלי אימון {translateMuscle(insight.muscle)}
        </>
      );
      sub = 'שווה לשלב באימון הקרוב';
      break;
    case 'streak':
      icon = <Flame size={18} aria-hidden="true" style={{ color: 'var(--fs-accent)' }} />;
      headline = (
        <>
          רצף של{' '}
          <span className="kinetic-number" dir="ltr">
            {insight.days}
          </span>{' '}
          ימי אימון
        </>
      );
      sub = 'שמרו על הקצב';
      break;
    case 'consistency':
      icon = <CalendarCheck size={18} aria-hidden="true" style={{ color: 'var(--fs-accent)' }} />;
      headline = (
        <>
          <span className="kinetic-number" dir="ltr">
            {insight.workoutsThisMonth}
          </span>{' '}
          אימונים החודש
        </>
      );
      sub = 'כל אימון נספר';
      break;
    case 'balanced':
      icon = <Activity size={18} aria-hidden="true" style={{ color: 'var(--fs-accent)' }} />;
      headline = (
        <>
          פיזור מאוזן על{' '}
          <span className="kinetic-number" dir="ltr">
            {insight.muscleCount}
          </span>{' '}
          קבוצות שריר
        </>
      );
      sub = 'אימון גוף מלא';
      break;
  }

  return (
    <FadeIn style={{ marginTop: 16 }}>
      <section
        role="note"
        aria-label="תובנת אימון"
        className="magnetic-card"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 16px',
          background: 'var(--fs-surface)',
          border: '1px solid var(--fs-surface-2)',
          borderRadius: '22px 16px 22px 16px',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 12,
            background: 'var(--fs-surface-2)',
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--fs-muted)',
            }}
          >
            תובנה
          </span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 15,
              lineHeight: 1.25,
              color: 'var(--fs-ink)',
            }}
          >
            {headline}
          </span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--fs-muted)' }}>
            {sub}
          </span>
        </span>
      </section>
    </FadeIn>
  );
});

export default InsightCard;
