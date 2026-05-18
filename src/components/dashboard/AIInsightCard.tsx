// ============================================================================
// AIInsightCard - Compact dashboard AI insight card (Fresh Steel style)
// ============================================================================

import { Activity, RefreshCw, Sparkles, Target, TrendingUp } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  type AIDashboardInsight,
  collectDashboardData,
  getAIDashboardInsight,
} from '../../services/ai/aiDashboardService';
import { AIError } from '../../services/ai/core';
import { humanizeAIError } from '../../services/ai/errorMessages';
import type { WorkoutSession } from '../../types';

interface AIInsightCardProps {
  sessions: WorkoutSession[];
}

export function AIInsightCard({ sessions }: AIInsightCardProps) {
  const [insight, setInsight] = useState<AIDashboardInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInsight = useCallback(async () => {
    if (sessions.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const data = await collectDashboardData(sessions);
      const result = await getAIDashboardInsight(data);
      setInsight(result);
    } catch (e) {
      if (e instanceof AIError) {
        setError(humanizeAIError(e));
      } else {
        setError('לא הצלחנו לייצר ניתוח כרגע');
      }
    } finally {
      setLoading(false);
    }
  }, [sessions]);

  useEffect(() => {
    loadInsight();
  }, [loadInsight]);

  if (sessions.length === 0) return null;

  const scoreColor = !insight
    ? 'var(--fs-muted)'
    : insight.fitnessScore >= 75
      ? 'var(--fs-accent)'
      : insight.fitnessScore >= 50
        ? 'var(--fs-accent)'
        : insight.fitnessScore >= 25
          ? 'var(--fs-warn)'
          : 'var(--fs-warn)';

  const focusIcon = getFocusIcon(insight?.focusArea || '');

  return (
    <div
      className="magnetic-card glass-surface fs-accent-rail"
      style={{
        borderRadius: '22px 16px 22px 16px',
        border: '1px solid var(--fs-surface-2)',
        boxShadow: 'var(--shadow-card)',
        padding: '16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            gap: 6,
            alignItems: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--fs-muted)',
          }}
        >
          <span className="breathing-dot" aria-hidden />
          AI INSIGHT
          <Sparkles size={11} style={{ color: 'var(--fs-signal)', marginInlineStart: 2 }} />
        </span>
        <button
          type="button"
          onClick={loadInsight}
          disabled={loading}
          style={{
            background: 'none',
            border: 'none',
            cursor: loading ? 'wait' : 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            color: 'var(--fs-muted)',
          }}
          aria-label="רענן ניתוח"
        >
          <RefreshCw
            size={12}
            style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}
          />
        </button>
      </div>

      {loading && !insight && (
        <div
          style={{ minHeight: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              border: '2px solid var(--fs-surface-2)',
              borderTopColor: 'var(--fs-accent)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
        </div>
      )}

      {error && !insight && (
        <div
          style={{
            padding: '8px 12px',
            background: 'var(--fs-bg)',
            borderRadius: 8,
            color: 'var(--fs-ink)',
            fontFamily: 'var(--font-hebrew)',
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {insight && (
        <>
          {/* Score + Label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            {/* Compact circular score */}
            <div
              style={{
                position: 'relative',
                width: 48,
                height: 48,
                flexShrink: 0,
              }}
            >
              {(() => {
                const circumference = 2 * Math.PI * 44;
                const pct = Math.max(0, Math.min(100, insight.fitnessScore));
                const dashOffset = circumference * (1 - pct / 100);
                const ringClass =
                  pct >= 75
                    ? 'ring-progress signal'
                    : pct < 25
                      ? 'ring-progress warn'
                      : 'ring-progress';
                return (
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 100 100"
                    role="img"
                    aria-label={`ציון כושר: ${insight.fitnessScore}`}
                  >
                    <circle
                      className="ring-track"
                      cx="50"
                      cy="50"
                      r="44"
                      strokeWidth="8"
                      fill="none"
                    />
                    <circle
                      className={ringClass}
                      cx="50"
                      cy="50"
                      r="44"
                      strokeWidth="8"
                      fill="none"
                      strokeDasharray={circumference}
                      strokeDashoffset={dashOffset}
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                );
              })()}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  fontSize: 13,
                  color: scoreColor,
                }}
              >
                <span className="kinetic-number">{insight.fitnessScore}</span>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: 'var(--font-hebrew)',
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--fs-ink)',
                  marginBottom: 1,
                }}
              >
                {insight.fitnessLabel}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'var(--fs-muted)',
                }}
              >
                {focusIcon}
                {insight.focusArea}
              </div>
            </div>
          </div>

          {/* Main recommendation */}
          <div
            className="glass-surface"
            style={{
              padding: '8px 12px',
              borderRadius: 14,
              marginBottom: 8,
              fontFamily: 'var(--font-hebrew)',
              fontSize: 12,
              lineHeight: 1.6,
              color: 'var(--fs-ink)',
            }}
          >
            {insight.mainRecommendation}
          </div>

          {/* Tips */}
          {insight.tips.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {insight.tips.map((tip) => (
                <div
                  key={tip}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 6,
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: 11,
                    lineHeight: 1.5,
                    color: 'var(--fs-muted)',
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: 3,
                      height: 3,
                      borderRadius: '50%',
                      background: 'var(--fs-signal)',
                      marginTop: 6,
                    }}
                  />
                  {tip}
                </div>
              ))}
            </div>
          )}

          {/* Loading overlay for refresh */}
          {loading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(var(--bone-rgb, 238,243,241), 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'inherit',
              }}
            >
              <RefreshCw
                size={16}
                style={{ color: 'var(--fs-primary)', animation: 'spin 1s linear infinite' }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function getFocusIcon(focus: string) {
  const lower = focus.toLowerCase();
  if (lower.includes('כוח') || lower.includes('strength')) return <Target size={10} />;
  if (lower.includes('היפר') || lower.includes('hypertrophy')) return <TrendingUp size={10} />;
  if (lower.includes('התאוש') || lower.includes('recovery')) return <Activity size={10} />;
  return <Target size={10} />;
}
