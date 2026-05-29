import { motion } from 'framer-motion';
import type React from 'react';
import { memo, useMemo, useState } from 'react';
import type { MuscleBalanceData } from '../../../services/analyticsService';

interface MuscleRadarChartProps {
  data: MuscleBalanceData[];
  size?: number;
  maxDisplay?: number;
}

const MUSCLE_STATUS_COLORS = {
  strong: 'var(--fs-accent)',
  stable: 'var(--fs-accent-2)',
  weak: 'var(--fs-warn)',
  neutral: 'var(--fs-accent)',
};

/**
 * MuscleRadarChart - SVG Radar chart showing muscle group balance
 */
const MuscleRadarChart: React.FC<MuscleRadarChartProps> = ({
  data,
  size = 180,
  maxDisplay = 8,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Take top muscles by volume, up to maxDisplay
  const displayData = useMemo(() => {
    return data.slice(0, maxDisplay);
  }, [data, maxDisplay]);

  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size * 0.35;
  const labelRadius = size * 0.48;

  const numPoints = displayData.length;
  const angleStep = numPoints > 0 ? (2 * Math.PI) / numPoints : 0;

  // Calculate polygon points
  const getPoint = (index: number, value: number): { x: number; y: number } => {
    const angle = index * angleStep - Math.PI / 2; // Start from top
    const normalizedValue = Math.min(value / 100, 1); // Normalize percentage to 0-1
    const r = radius * normalizedValue;
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  };

  // Calculate label positions
  const getLabelPosition = (index: number): { x: number; y: number; anchor: string } => {
    const angle = index * angleStep - Math.PI / 2;
    const r = labelRadius;
    const x = centerX + r * Math.cos(angle);
    const y = centerY + r * Math.sin(angle);

    // Determine text anchor based on position
    let anchor = 'middle';
    if (Math.cos(angle) > 0.1) anchor = 'start';
    else if (Math.cos(angle) < -0.1) anchor = 'end';

    return { x, y, anchor };
  };

  // Build polygon path
  const polygonPoints = useMemo(() => {
    return displayData
      .map((muscle, i) => {
        const point = getPoint(i, muscle.percentage);
        return `${point.x},${point.y}`;
      })
      .join(' ');
  }, [displayData]);

  // Build background polygon (full radius)
  const backgroundPoints = useMemo(() => {
    return Array.from({ length: numPoints }, (_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
  }, [numPoints, radius, centerX, centerY]);

  // Build axis lines
  const axisLines = useMemo(() => {
    return Array.from({ length: numPoints }, (_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const endX = centerX + radius * Math.cos(angle);
      const endY = centerY + radius * Math.sin(angle);
      return { x1: centerX, y1: centerY, x2: endX, y2: endY };
    });
  }, [numPoints, radius, centerX, centerY]);

  // Get color for muscle status
  const getMuscleColor = (muscle: MuscleBalanceData): string => {
    if (muscle.isWeak) return MUSCLE_STATUS_COLORS.weak;
    if (muscle.trend === 'up') return MUSCLE_STATUS_COLORS.strong;
    if (muscle.trend === 'down') return MUSCLE_STATUS_COLORS.weak;
    return MUSCLE_STATUS_COLORS.stable;
  };

  return (
    <div
      className="relative magnetic-card glass-surface scrim-noise"
      style={{ padding: 16, borderRadius: '22px 16px 22px 16px' }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--fs-muted)',
          marginBottom: 8,
        }}
      >
        § MUSCLE RADAR
      </div>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        {/* Background circle grid */}
        {[0.25, 0.5, 0.75, 1].map((level) => (
          <circle
            key={level}
            cx={centerX}
            cy={centerY}
            r={radius * level}
            fill="none"
            stroke="var(--fs-surface-2)"
            strokeOpacity={0.4}
            strokeDasharray="2 2"
          />
        ))}

        {/* Axis lines */}
        {axisLines.map((line, i) => (
          <line
            // biome-ignore lint/suspicious/noArrayIndexKey: positional radar axis geometry, fixed count, never reordered
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="var(--fs-surface-2)"
            strokeOpacity={0.6}
            strokeWidth={1}
          />
        ))}

        {/* Background polygon (full) */}
        <motion.polygon
          points={backgroundPoints}
          fill="color-mix(in srgb, var(--fs-accent) 8%, transparent)"
          stroke="color-mix(in srgb, var(--fs-accent) 20%, transparent)"
          strokeWidth={1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />

        {/* Data polygon */}
        <motion.polygon
          points={polygonPoints}
          fill="color-mix(in srgb, var(--fs-accent) 22%, transparent)"
          stroke="var(--fs-accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{
            filter: 'drop-shadow(0 6px 16px color-mix(in srgb, var(--fs-accent) 25%, transparent))',
          }}
        />

        {/* Data points */}
        {displayData.map((muscle, i) => {
          const point = getPoint(i, muscle.percentage);

          return (
            <motion.circle
              key={muscle.muscle}
              cx={point.x}
              cy={point.y}
              r={hoveredIndex === i ? 8 : 6}
              fill={getMuscleColor(muscle)}
              stroke="rgba(0, 0, 0, 0.3)"
              strokeWidth={2}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3 + i * 0.05, type: 'spring', stiffness: 200 }}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          );
        })}

        {/* Center dot */}
        <circle cx={centerX} cy={centerY} r={3} fill="var(--fs-muted)" />

        {/* Labels */}
        {displayData.map((muscle, i) => {
          const pos = getLabelPosition(i);
          const color = getMuscleColor(muscle);

          return (
            <motion.text
              key={muscle.muscle}
              x={pos.x}
              y={pos.y}
              textAnchor={pos.anchor as 'start' | 'middle' | 'end'}
              fontSize={9}
              fill={color}
              fontWeight="bold"
              initial={{ opacity: 0 }}
              animate={{ opacity: hoveredIndex === i ? 1 : 0.8 }}
              transition={{ delay: 0.4 + i * 0.05 }}
            >
              {muscle.muscle.length > 6 ? `${muscle.muscle.slice(0, 5)}…` : muscle.muscle}
            </motion.text>
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {hoveredIndex !== null && displayData[hoveredIndex] && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full bg-black/95 text-white text-[10px] px-3 py-2 rounded-lg whitespace-nowrap shadow-lg border border-white/10 pointer-events-none"
        >
          <div className="font-bold text-sm">{displayData[hoveredIndex].muscle}</div>
          <div className="text-white/70">{displayData[hoveredIndex].percentage}% מהנפח</div>
          <div className="flex items-center gap-1 mt-1">
            {displayData[hoveredIndex].isWeak && (
              <span className="text-red-400 text-[8px]">מוזנח</span>
            )}
            {displayData[hoveredIndex].trend === 'up' && (
              <span className="text-green-400 text-[8px]">↑ בעלייה</span>
            )}
            {displayData[hoveredIndex].trend === 'down' && (
              <span className="text-red-400 text-[8px]">↓ בירידה</span>
            )}
          </div>
        </motion.div>
      )}

      {/* Legend */}
      <div className="absolute -bottom-6 left-0 right-0 flex items-center justify-center gap-4 text-[8px]">
        <div className="flex items-center gap-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: MUSCLE_STATUS_COLORS.strong }}
          />
          <span className="text-white/50">חזק</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: MUSCLE_STATUS_COLORS.stable }}
          />
          <span className="text-white/50">יציב</span>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: MUSCLE_STATUS_COLORS.weak }}
          />
          <span className="text-white/50">מוזנח</span>
        </div>
      </div>
    </div>
  );
};

export default memo(MuscleRadarChart);
