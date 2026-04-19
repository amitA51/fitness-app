import { motion } from 'framer-motion';
import type React from 'react';
import { memo, useMemo } from 'react';
import type { ForecastData, WeeklyVolume } from '../../../services/analyticsService';

interface TrendLineOverlayProps {
  data: WeeklyVolume[];
  forecast: ForecastData | null;
  maxVolume: number;
  hoveredIndex: number | null;
  onHover: (index: number | null) => void;
  svgWidth: number;
  chartHeight: number;
  barWidth: number;
  barGap: number;
}

/**
 * TrendLineOverlay - Renders trend line and forecast on top of bar chart
 */
const TrendLineOverlay: React.FC<TrendLineOverlayProps> = ({
  data,
  forecast,
  maxVolume,
  onHover,
  chartHeight,
  barWidth,
  barGap,
}) => {
  // Calculate trend line points using linear regression
  const trendPoints = useMemo(() => {
    if (data.length < 2) return [];

    const volumes = data.map((w) => w.totalVolume);
    const n = volumes.length;

    // Simple moving average for trend
    const points: { x: number; y: number }[] = [];

    // Start point (first bar center)
    const firstVol = volumes[0] ?? 0;
    const startX = 10 + barGap;
    const startY = chartHeight - (firstVol / maxVolume) * (chartHeight - 30);
    points.push({ x: startX, y: startY });

    // End point (last bar center)
    const lastVol = volumes[n - 1] ?? 0;
    const endX = 10 + (n - 1) * (barWidth + barGap) + barWidth;
    const endY = chartHeight - (lastVol / maxVolume) * (chartHeight - 30);
    points.push({ x: endX, y: endY });

    return points;
  }, [data, maxVolume, chartHeight, barWidth, barGap]);

  // Calculate forecast point
  const forecastPoint = useMemo(() => {
    if (!forecast || forecast.predicted <= 0 || data.length < 2) return null;

    const lastBarX = 10 + (data.length - 1) * (barWidth + barGap) + barWidth;
    const forecastX = lastBarX + barWidth + barGap;
    const forecastY = chartHeight - (forecast.predicted / maxVolume) * (chartHeight - 30);

    return { x: forecastX, y: forecastY, predicted: forecast.predicted };
  }, [forecast, data.length, maxVolume, chartHeight, barWidth, barGap]);

  if (trendPoints.length < 2) return null;

  const [startPoint, endPoint] = trendPoints;
  if (!startPoint || !endPoint) return null;

  return (
    <g className="trend-overlay">
      {/* Trend Line */}
      <motion.line
        x1={startPoint.x}
        y1={startPoint.y}
        x2={endPoint.x}
        y2={endPoint.y}
        stroke="rgba(251, 191, 36, 0.8)"
        strokeWidth={2}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.5, duration: 0.8 }}
      />

      {/* Trend arrow at end */}
      <motion.circle
        cx={endPoint.x}
        cy={endPoint.y}
        r={4}
        fill="rgba(251, 191, 36, 0.8)"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.8 }}
      />

      {/* Forecast Point */}
      {forecastPoint && (
        <>
          {/* Dashed line from last point to forecast */}
          <motion.line
            x1={endPoint.x}
            y1={endPoint.y}
            x2={forecastPoint.x}
            y2={forecastPoint.y}
            stroke="rgba(251, 191, 36, 0.4)"
            strokeWidth={1}
            strokeDasharray="4 4"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.9, duration: 0.5 }}
          />

          {/* Forecast point */}
          <motion.circle
            cx={forecastPoint.x}
            cy={forecastPoint.y}
            r={6}
            fill="rgba(251, 191, 36, 0.3)"
            stroke="rgba(251, 191, 36, 0.8)"
            strokeWidth={2}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1.0, type: 'spring', stiffness: 200 }}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => onHover(data.length)}
            onMouseLeave={() => onHover(null)}
          />

          {/* Forecast label */}
          <motion.text
            x={forecastPoint.x}
            y={forecastPoint.y - 12}
            textAnchor="middle"
            fontSize={9}
            fill="rgba(251, 191, 36, 0.9)"
            fontWeight="bold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
          >
            {forecastPoint.predicted.toLocaleString()}
          </motion.text>
        </>
      )}
    </g>
  );
};

export default memo(TrendLineOverlay);
