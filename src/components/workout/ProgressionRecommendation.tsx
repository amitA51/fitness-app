/**
 * ProgressionRecommendation - Component to display weight progression recommendations
 * Shows user when to increase/decrease weight with confidence indicators
 */

import type React from 'react';
import {
  type ExerciseProgressionData,
  getRecommendationColor,
  getRecommendationIcon,
  getRecommendationLabel,
} from '../../services/progressionService';

// ============================================================================
// TYPES
// ============================================================================

interface ProgressionRecommendationProps {
  data: ExerciseProgressionData;
  compact?: boolean;
  showHistory?: boolean;
  onWeightChange?: (newWeight: number) => void;
}

interface ProgressionBadgeProps {
  recommendation: ExerciseProgressionData['recommendation'];
  confidence: number;
}

interface ProgressionHistoryProps {
  history: ExerciseProgressionData['history'];
}

// ============================================================================
// COMPONENT: Main Recommendation Display
// ============================================================================

export const ProgressionRecommendation: React.FC<ProgressionRecommendationProps> = ({
  data,
  compact = false,
  onWeightChange,
}) => {
  const label = getRecommendationLabel(data.recommendation);
  const colorClass = getRecommendationColor(data.recommendation);
  const icon = getRecommendationIcon(data.recommendation);

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${colorClass}`}>
        <span className="text-lg">{icon}</span>
        <span className="font-semibold">{label}</span>
        {data.confidence >= 70 && <ConfidenceIndicator confidence={data.confidence} />}
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-xl p-4 border border-slate-700/50">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">{data.exerciseName}</h3>
          <ProgressionBadge recommendation={data.recommendation} confidence={data.confidence} />
        </div>

        {/* Weight Display */}
        <div className="text-start">
          <div className="text-2xl font-bold text-white">
            {data.suggestedWeight > 0 ? (
              <>
                <span className={colorClass}>{data.suggestedWeight}</span>
                <span className="text-slate-400 text-sm me-1">ק"ג</span>
              </>
            ) : (
              <span className="text-slate-400">-</span>
            )}
          </div>
          {data.weightChange !== 0 && (
            <div className={`text-xs ${data.weightChange > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.weightChange > 0 ? '+' : ''}
              {data.weightChange} ק"ג
            </div>
          )}
        </div>
      </div>

      {/* Reasons */}
      <div className="space-y-1 mb-3">
        {data.reasons.slice(0, 2).map((reason, index) => (
          <div key={reason.code} className="flex items-start gap-2 text-sm">
            <span className="text-slate-500 mt-0.5">{index === 0 ? '•' : '○'}</span>
            <span className="text-slate-300">{reason.message}</span>
          </div>
        ))}
      </div>

      {/* Last Session Info */}
      {data.lastSession && (
        <div className="flex items-center gap-4 text-xs text-slate-400 border-t border-slate-700/50 pt-3">
          <span>
            <span className="text-slate-500">בפעם האחרונה:</span>{' '}
            <span className="text-slate-300">
              {data.lastSession.weight} ק"ג × {data.lastSession.reps}
            </span>
          </span>
          {data.lastSession.rpe && (
            <span>
              <span className="text-slate-500">RPE:</span>{' '}
              <span className="text-slate-300">{data.lastSession.rpe}/10</span>
            </span>
          )}
        </div>
      )}

      {/* Quick Action Button */}
      {onWeightChange && data.recommendation === 'INCREASE_WEIGHT' && (
        <button
          type="button"
          onClick={() => onWeightChange(data.suggestedWeight)}
          className="w-full mt-3 py-2 px-4 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors"
        >
          עדכן ל-{data.suggestedWeight} ק"ג
        </button>
      )}
    </div>
  );
};

// ============================================================================
// COMPONENT: Badge
// ============================================================================

const ProgressionBadge: React.FC<ProgressionBadgeProps> = ({ recommendation, confidence }) => {
  const label = getRecommendationLabel(recommendation);
  const colorClass = getRecommendationColor(recommendation);
  const icon = getRecommendationIcon(recommendation);

  const bgColors: Record<string, string> = {
    INCREASE_WEIGHT: 'bg-green-500/20 border-green-500/30',
    MAINTAIN: 'bg-yellow-500/20 border-yellow-500/30',
    DECREASE_WEIGHT: 'bg-red-500/20 border-red-500/30',
    INCREASE_REPS: 'bg-blue-500/20 border-blue-500/30',
    DELOAD: 'bg-orange-500/20 border-orange-500/30',
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border ${bgColors[recommendation]}`}
    >
      <span>{icon}</span>
      <span className={`font-medium ${colorClass}`}>{label}</span>
      {confidence >= 70 && <span className="text-xs text-slate-400">({confidence}%)</span>}
    </div>
  );
};

// ============================================================================
// COMPONENT: Confidence Indicator
// ============================================================================

const ConfidenceIndicator: React.FC<{ confidence: number }> = ({ confidence }) => {
  const getColor = (c: number) => {
    if (c >= 80) return 'bg-green-500';
    if (c >= 60) return 'bg-yellow-500';
    return 'bg-slate-500';
  };

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3].map((level) => (
        <div
          key={level}
          className={`w-1.5 h-3 rounded-full ${
            confidence >= level * 30 ? getColor(confidence) : 'bg-slate-600'
          }`}
        />
      ))}
    </div>
  );
};

// ============================================================================
// COMPONENT: History Timeline
// ============================================================================

export const ProgressionHistory: React.FC<ProgressionHistoryProps> = ({ history }) => {
  if (history.length === 0) {
    return <div className="text-center text-slate-500 py-4">אין עדיין היסטוריה לתרגיל זה</div>;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-slate-400 mb-3">היסטוריית אימונים</h4>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {history
          .slice()
          .reverse()
          .map((session, index) => (
            <div
              key={session.date}
              className={`flex items-center justify-between p-2 rounded-lg ${
                index === 0 ? 'bg-slate-700/50' : 'bg-slate-800/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${
                    session.wasCompleted ? 'bg-green-500' : 'bg-yellow-500'
                  }`}
                />
                <span className="text-sm text-slate-300">
                  {new Date(session.date).toLocaleDateString('he-IL')}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-white font-medium">
                  {session.weight} ק"ג × {session.reps}
                </span>
                {session.rpe && (
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      session.rpe >= 9
                        ? 'bg-red-500/20 text-red-400'
                        : session.rpe >= 7
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-green-500/20 text-green-400'
                    }`}
                  >
                    RPE {session.rpe}
                  </span>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

// ============================================================================
// COMPONENT: Summary Card (Dashboard)
// ============================================================================

interface ProgressionSummaryProps {
  recommendations: ExerciseProgressionData[];
}

export const ProgressionSummary: React.FC<ProgressionSummaryProps> = ({ recommendations }) => {
  const readyToIncrease = recommendations.filter((r) => r.recommendation === 'INCREASE_WEIGHT');
  const shouldMaintain = recommendations.filter((r) => r.recommendation === 'MAINTAIN');
  const needDeload = recommendations.filter(
    (r) => r.recommendation === 'DECREASE_WEIGHT' || r.recommendation === 'DELOAD'
  );

  return (
    <div className="space-y-3">
      {/* Ready to increase */}
      {readyToIncrease.length > 0 && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-500">↑</span>
            <span className="text-green-400 font-medium">
              מוכנים להעלות ({readyToIncrease.length})
            </span>
          </div>
          <div className="space-y-1">
            {readyToIncrease.map((r) => (
              <div key={r.exerciseId} className="flex justify-between text-sm">
                <span className="text-slate-300">{r.exerciseName}</span>
                <span className="text-green-400">
                  <span dir="ltr">
                    {r.currentWeight} → {r.suggestedWeight}
                  </span>{' '}
                  ק"ג
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Should maintain */}
      {shouldMaintain.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-yellow-500">→</span>
            <span className="text-yellow-400 font-medium">
              לשמור על המשקל ({shouldMaintain.length})
            </span>
          </div>
          <div className="space-y-1">
            {shouldMaintain.map((r) => (
              <div key={r.exerciseId} className="flex justify-between text-sm">
                <span className="text-slate-300">{r.exerciseName}</span>
                <span className="text-yellow-400">{r.currentWeight} ק"ג</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Need deload */}
      {needDeload.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-500">↓</span>
            <span className="text-red-400 font-medium">להוריד משקל ({needDeload.length})</span>
          </div>
          <div className="space-y-1">
            {needDeload.map((r) => (
              <div key={r.exerciseId} className="flex justify-between text-sm">
                <span className="text-slate-300">{r.exerciseName}</span>
                <span className="text-red-400">
                  <span dir="ltr">
                    {r.currentWeight} → {r.suggestedWeight}
                  </span>{' '}
                  ק"ג
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recommendations.length === 0 && (
        <div className="text-center text-slate-500 py-6">אין המלצות זמינות כרגע</div>
      )}
    </div>
  );
};

export default ProgressionRecommendation;
