// ============================================================================
// AIInsightCard - Dashboard AI fitness analysis card
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
    ? 'var(--stone)'
    : insight.fitnessScore >= 75
      ? '#10B981'
      : insight.fitnessScore >= 50
        ? '#F59E0B'
        : insight.fitnessScore >= 25
          ? '#F97316'
          : '#EF4444';

  const focusIcon = getFocusIcon(insight?.focusArea || '');

  return (
    <div
      className="card-outlined"
      style={{
        padding: '20px',
        marginTop: 12,
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
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={16} style={{ color: 'var(--mustard)' }} />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--stone)',
            }}
          >
            AI Coach
          </span>
        </div>
        <button
          type="button"
          onClick={loadInsight}
          disabled={loading}
          className="focus-ring"
          style={{
            background: 'none',
            border: 'none',
            cursor: loading ? 'wait' : 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
            color: 'var(--stone)',
            transition: 'transform 0.3s',
            transform: loading ? 'rotate(360deg)' : 'none',
          }}
          aria-label="רענן ניתוח"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {loading && !insight && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 120 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--bone-deep)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: 12,
                  borderRadius: 6,
                  background: 'var(--bone-deep)',
                  width: '60%',
                  marginBottom: 8,
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
              <div
                style={{
                  height: 10,
                  borderRadius: 5,
                  background: 'var(--bone-deep)',
                  width: '40%',
                  animation: 'pulse 1.5s ease-in-out infinite',
                }}
              />
            </div>
          </div>
          <div
            style={{
              height: 10,
              borderRadius: 5,
              background: 'var(--bone-deep)',
              width: '100%',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
          <div
            style={{
              height: 10,
              borderRadius: 5,
              background: 'var(--bone-deep)',
              width: '80%',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        </div>
      )}

      {error && !insight && (
        <div
          style={{
            padding: '12px 16px',
            background: '#FEF2F2',
            borderRadius: 8,
            color: '#991B1B',
            fontFamily: 'var(--font-hebrew)',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {insight && (
        <>
          {/* Score + Label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            {/* Circular score */}
            <div
              style={{
                position: 'relative',
                width: 64,
                height: 64,
                flexShrink: 0,
              }}
            >
              <svg
                width="64"
                height="64"
                viewBox="0 0 64 64"
                style={{ transform: 'rotate(-90deg)' }}
                role="img"
                aria-label={`ציון כושר: ${insight.fitnessScore}`}
              >
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke="var(--bone-deep)"
                  strokeWidth="5"
                />
                <circle
                  cx="32"
                  cy="32"
                  r="26"
                  fill="none"
                  stroke={scoreColor}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${(insight.fitnessScore / 100) * 163.36} 163.36`}
                  style={{ transition: 'stroke-dasharray 0.8s ease' }}
                />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 18,
                  color: scoreColor,
                }}
              >
                {insight.fitnessScore}
              </div>
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: 'var(--font-hebrew)',
                  fontSize: 14,
                  fontWeight: 700,
                  color: 'var(--navy)',
                  marginBottom: 2,
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
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--stone)',
                }}
              >
                {focusIcon}
                {insight.focusArea}
              </div>
            </div>
          </div>

          {/* Main recommendation */}
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--bone-deep)',
              borderRadius: 8,
              marginBottom: 12,
              fontFamily: 'var(--font-hebrew)',
              fontSize: 13,
              lineHeight: 1.6,
              color: 'var(--navy)',
            }}
          >
            {insight.mainRecommendation}
          </div>

          {/* Tips */}
          {insight.tips.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {insight.tips.map((tip) => (
                <div
                  key={tip}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    fontFamily: 'var(--font-hebrew)',
                    fontSize: 12,
                    lineHeight: 1.5,
                    color: 'var(--stone)',
                  }}
                >
                  <span
                    style={{
                      flexShrink: 0,
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      background: 'var(--mustard)',
                      marginTop: 7,
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
                background: 'rgba(var(--bone-rgb, 245,243,240), 0.8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 'inherit',
              }}
            >
              <RefreshCw
                size={20}
                style={{
                  color: 'var(--navy)',
                  animation: 'spin 1s linear infinite',
                }}
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
  if (lower.includes('כוח') || lower.includes('strength')) return <Target size={12} />;
  if (lower.includes('היפר') || lower.includes('hypertrophy')) return <TrendingUp size={12} />;
  if (lower.includes('התאוש') || lower.includes('recovery')) return <Activity size={12} />;
  return <Target size={12} />;
}
