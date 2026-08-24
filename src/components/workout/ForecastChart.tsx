// ForecastChart — Fresh Steel / Obsidian design language
// Weekly volume history + next-week projection for ONE exercise (controlled by
// the parent's exercise selection — no second selector on the screen).
// The series is weekly on both sides: actuals are the same ISO-week buckets the
// regression runs on, and the appended "תחזית" point is the predicted volume
// for the NEXT week — same scale by construction (see forecastSeries.ts).

import { LineChart } from 'lucide-react';
import type React from 'react';
import { memo, useMemo } from 'react';
import type { WorkoutSession } from '../../types';
import { logger } from '../../utils/logger';
import { GlowAreaChart } from '../charts/GlowAreaChart';
import { MIN_SESSIONS_FOR_FORECAST, buildForecastSeries } from './forecastSeries';

interface ForecastChartProps {
  sessions: WorkoutSession[];
  /** Raw exerciseName as it appears on sessions (parent-controlled selection). */
  exerciseName: string | null;
  /** Short display label for headings/aria (e.g. name without equipment suffix). */
  exerciseLabel?: string;
  isLoading?: boolean;
}

const cardStyle: React.CSSProperties = {
  background: 'var(--fs-surface)',
  borderRadius: 'var(--radius-asymmetric)',
  border: '1px solid var(--fs-surface-2)',
  boxShadow: 'var(--shadow-card)',
  padding: '16px 20px',
};

const headerStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '-0.01em',
  color: 'var(--fs-muted)',
  marginBottom: 12,
};

const ForecastChart: React.FC<ForecastChartProps> = ({
  sessions,
  exerciseName,
  exerciseLabel,
  isLoading,
}) => {
  const series = useMemo(() => {
    try {
      return buildForecastSeries(sessions, exerciseName);
    } catch (e) {
      logger.analytics.error('Failed to build forecast series', e);
      return null; // null = computation error (distinct from empty data)
    }
  }, [sessions, exerciseName]);

  if (!exerciseName) return null;

  const label = exerciseLabel || exerciseName;

  // Loading — skeleton matching the chart card shape.
  if (isLoading) {
    return (
      <div style={cardStyle} aria-hidden="true">
        <div style={headerStyle}>תחזית נפח שבועי</div>
        <div
          className="animate-pulse"
          style={{ height: 150, borderRadius: 12, background: 'var(--fs-surface-2)' }}
        />
      </div>
    );
  }

  // Error — explicit, with the recovery path (data recomputes on refresh).
  if (series === null) {
    return (
      <div style={cardStyle}>
        <h3 style={headerStyle}>תחזית נפח שבועי</h3>
        <p
          role="alert"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--fs-muted)',
            textAlign: 'center',
            padding: '20px 0',
          }}
        >
          לא הצלחנו לחשב את התחזית. רעננו את העמוד ונסו שוב.
        </p>
      </div>
    );
  }

  // Empty — composed guidance: how many more sessions until the forecast shows.
  if (series.points.length < 2 || !series.forecast) {
    const remaining = Math.max(1, MIN_SESSIONS_FOR_FORECAST - series.sessionCount);
    return (
      <div style={cardStyle}>
        <h3 style={headerStyle}>תחזית נפח שבועי · {label}</h3>
        <div className="flex flex-col items-center text-center gap-2" style={{ padding: '16px 0' }}>
          <LineChart size={28} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--fs-ink)' }}>
            התחזית נבנית מ־
            <span className="kinetic-number" dir="ltr">
              {MIN_SESSIONS_FOR_FORECAST}
            </span>{' '}
            אימונים לפחות עם התרגיל הזה
          </p>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'var(--fs-muted)' }}>
            {remaining === 1 ? (
              'עוד אימון אחד והתחזית תופיע כאן'
            ) : (
              <>
                עוד{' '}
                <span className="kinetic-number" dir="ltr">
                  {remaining}
                </span>{' '}
                אימונים והתחזית תופיע כאן
              </>
            )}
          </p>
        </div>
      </div>
    );
  }

  const { forecast } = series;

  return (
    <div style={cardStyle}>
      <h3 style={headerStyle}>תחזית נפח שבועי · {label}</h3>

      <GlowAreaChart
        data={series.points}
        accent="var(--fs-accent)"
        accent2="var(--fs-accent-2)"
        xAxis
        ariaLabel={`נפח שבועי ותחזית לשבוע הבא עבור ${label}`}
      />

      {/* Forecast read-out */}
      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: '1px solid var(--fs-surface-2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '-0.01em',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--fs-muted)' }}>תחזית לשבוע הבא:</span>
          <span
            className="kinetic-number"
            dir="ltr"
            style={{ fontWeight: 700, color: 'var(--fs-heading)' }}
          >
            {forecast.predicted.toLocaleString()}
          </span>
          <span style={{ color: 'var(--fs-muted)' }}>ק״ג</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              color:
                forecast.trend === 'increasing'
                  ? 'var(--color-success-fg)'
                  : forecast.trend === 'decreasing'
                    ? 'var(--color-error-fg)'
                    : 'var(--fs-muted)',
            }}
          >
            {forecast.trend === 'increasing'
              ? '↑ בעלייה'
              : forecast.trend === 'decreasing'
                ? '↓ בירידה'
                : '→ יציב'}
          </span>
          <span style={{ color: 'var(--fs-muted)' }}>
            <span className="kinetic-number" dir="ltr">
              {Math.round(forecast.confidence * 100)}%
            </span>{' '}
            ביטחון
          </span>
        </div>
      </div>
    </div>
  );
};

export default memo(ForecastChart);
