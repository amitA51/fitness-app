import { motion, useSpring, useTransform } from 'framer-motion';
// IntensityMeter - Real-time workout intensity visualization
// Apple Fitness+ inspired intensity zones with animated gauge
import { memo, useEffect, useState } from 'react';

// ============================================================
// TYPES
// ============================================================

export type IntensityZone = 'warmup' | 'fatburn' | 'cardio' | 'peak' | 'max';

interface IntensityMeterProps {
  /** Current intensity value (0-100) */
  intensity: number;
  /** Current volume in kg */
  currentVolume?: number;
  /** Target volume for this workout */
  targetVolume?: number;
  /** Sets completed */
  setsCompleted?: number;
  /** Total sets */
  totalSets?: number;
  /** Whether workout is active */
  isActive?: boolean;
  /** Compact mode for header display */
  compact?: boolean;
  /** Show volume bar */
  showVolume?: boolean;
  /** Custom class */
  className?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const ZONES: Record<
  IntensityZone,
  {
    label: string;
    labelHe: string;
    color: string;
    gradient: string;
    range: [number, number];
  }
> = {
  warmup: {
    label: 'WARM UP',
    labelHe: 'חימום',
    color: '#30D158',
    gradient: 'linear-gradient(135deg, #30D158, #34C759)',
    range: [0, 20],
  },
  fatburn: {
    label: 'FAT BURN',
    labelHe: 'שריפת שומן',
    color: '#FFD60A',
    gradient: 'linear-gradient(135deg, #FFD60A, #FF9F0A)',
    range: [20, 40],
  },
  cardio: {
    label: 'CARDIO',
    labelHe: 'אירובי',
    color: '#FF9F0A',
    gradient: 'linear-gradient(135deg, #FF9F0A, #FF6B35)',
    range: [40, 60],
  },
  peak: {
    label: 'PEAK',
    labelHe: 'שיא',
    color: '#FF453A',
    gradient: 'linear-gradient(135deg, #FF453A, #FF2D55)',
    range: [60, 80],
  },
  max: {
    label: 'MAXIMUM',
    labelHe: 'מקסימום',
    color: '#BF5AF2',
    gradient: 'linear-gradient(135deg, #BF5AF2, #FF2D55)',
    range: [80, 100],
  },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const getZoneFromIntensity = (intensity: number): IntensityZone => {
  if (intensity < 20) return 'warmup';
  if (intensity < 40) return 'fatburn';
  if (intensity < 60) return 'cardio';
  if (intensity < 80) return 'peak';
  return 'max';
};

const getZoneProgress = (intensity: number, zone: IntensityZone): number => {
  const { range } = ZONES[zone];
  if (intensity < range[0]) return 0;
  if (intensity > range[1]) return 1;
  return (intensity - range[0]) / (range[1] - range[0]);
};

// ============================================================
// SUB-COMPONENTS
// ============================================================

/** Animated arc gauge */
const ArcGauge = memo<{ intensity: number; size: number; strokeWidth: number }>(
  ({ intensity, size, strokeWidth }) => {
    const springIntensity = useSpring(intensity, { stiffness: 100, damping: 20 });
    const zone = getZoneFromIntensity(intensity);
    const zoneData = ZONES[zone];

    const radius = (size - strokeWidth) / 2;
    const circumference = radius * Math.PI; // Half circle
    const progress = useTransform(springIntensity, [0, 100], [0, circumference]);

    return (
      <svg
        width={size}
        height={size / 2 + strokeWidth}
        className="overflow-visible"
        style={{ transform: 'rotate(180deg)' }}
      >
        {/* Background arc */}
        <path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Zone segments */}
        {Object.entries(ZONES).map(([key, data], _index) => {
          const startAngle = (data.range[0] / 100) * 180;
          const endAngle = (data.range[1] / 100) * 180;
          const startRad = (startAngle * Math.PI) / 180;
          const endRad = (endAngle * Math.PI) / 180;

          const x1 = size / 2 + radius * Math.cos(Math.PI - startRad);
          const y1 = size / 2 - radius * Math.sin(Math.PI - startRad);
          const x2 = size / 2 + radius * Math.cos(Math.PI - endRad);
          const y2 = size / 2 - radius * Math.sin(Math.PI - endRad);

          return (
            <path
              key={key}
              d={`M ${x1} ${y1} A ${radius} ${radius} 0 0 0 ${x2} ${y2}`}
              fill="none"
              stroke={data.color}
              strokeWidth={strokeWidth - 4}
              strokeLinecap="butt"
              opacity={intensity >= data.range[0] ? 0.3 : 0.1}
              style={{ transition: 'opacity 0.3s ease' }}
            />
          );
        })}

        {/* Active progress arc */}
        <motion.path
          d={`M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`}
          fill="none"
          stroke={`url(#intensity-gradient-${zone})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset: useTransform(progress, (v) => circumference - v) }}
        />

        {/* Glow effect */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={zoneData.color}
          strokeWidth={strokeWidth + 8}
          opacity={0.2}
          filter="blur(8px)"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: useTransform(progress, (v) => circumference - v),
          }}
        />

        {/* Gradient definitions */}
        <defs>
          {Object.entries(ZONES).map(([key, data]) => (
            <linearGradient
              key={key}
              id={`intensity-gradient-${key}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="0%"
            >
              <stop offset="0%" stopColor={data.color} />
              <stop
                offset="100%"
                stopColor={
                  ZONES[
                    key === 'max'
                      ? 'max'
                      : (Object.keys(ZONES)[Object.keys(ZONES).indexOf(key) + 1] as IntensityZone)
                  ]?.color || data.color
                }
              />
            </linearGradient>
          ))}
        </defs>
      </svg>
    );
  }
);

ArcGauge.displayName = 'ArcGauge';

/** Zone indicator bar */
const ZoneBar = memo<{ intensity: number }>(({ intensity }) => {
  const zone = getZoneFromIntensity(intensity);

  return (
    <div className="flex gap-1 w-full">
      {Object.entries(ZONES).map(([key, data]) => {
        const isActive = key === zone;
        const isPassed = intensity >= data.range[1];

        return (
          <motion.div
            key={key}
            className="flex-1 h-2 rounded-full overflow-hidden"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          >
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{
                width: isPassed
                  ? '100%'
                  : isActive
                    ? `${getZoneProgress(intensity, key as IntensityZone) * 100}%`
                    : '0%',
              }}
              style={{
                background: data.gradient,
                boxShadow: isActive ? `0 0 12px ${data.color}` : 'none',
              }}
              transition={{ type: 'spring', stiffness: 200, damping: 25 }}
            />
          </motion.div>
        );
      })}
    </div>
  );
});

ZoneBar.displayName = 'ZoneBar';

/** Volume progress bar */
const VolumeBar = memo<{ current: number; target: number }>(({ current, target }) => {
  const percentage = Math.min((current / target) * 100, 100);
  const isComplete = current >= target;

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-white/60">נפח אימון</span>
        <span className="text-white font-medium tabular-nums">
          {current.toLocaleString()} / {target.toLocaleString()} ק״ג
        </span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          style={{
            background: isComplete
              ? 'linear-gradient(90deg, #30D158, #34C759)'
              : 'linear-gradient(90deg, var(--fs-accent), var(--fs-accent-2))',
            boxShadow: isComplete ? '0 0 12px #30D158' : undefined,
          }}
          transition={{ type: 'spring', stiffness: 100, damping: 20 }}
        />
      </div>
    </div>
  );
});

VolumeBar.displayName = 'VolumeBar';

/** Pulsing indicator dot */
const PulsingDot = memo<{ color: string; isActive: boolean }>(({ color, isActive }) => (
  <motion.div
    className="relative w-3 h-3"
    animate={isActive ? { scale: [1, 1.2, 1] } : { scale: 1 }}
    transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
  >
    <div className="absolute inset-0 rounded-full" style={{ backgroundColor: color }} />
    {isActive && (
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: color }}
        animate={{ scale: [1, 2], opacity: [0.5, 0] }}
        transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, ease: 'easeOut' }}
      />
    )}
  </motion.div>
));

PulsingDot.displayName = 'PulsingDot';

// ============================================================
// MAIN COMPONENT
// ============================================================

/**
 * IntensityMeter - Real-time workout intensity visualization
 *
 * Features:
 * - Arc gauge with zone colors
 * - Zone progress bar
 * - Volume tracking
 * - Animated transitions
 * - Compact mode for headers
 */
const IntensityMeter = memo<IntensityMeterProps>(
  ({
    intensity,
    currentVolume = 0,
    targetVolume = 10000,
    setsCompleted = 0,
    totalSets = 0,
    isActive = true,
    compact = false,
    showVolume = true,
    className = '',
  }) => {
    const zone = getZoneFromIntensity(intensity);
    const zoneData = ZONES[zone];

    // Animate intensity changes
    const [displayIntensity, setDisplayIntensity] = useState(0);

    useEffect(() => {
      const timer = setTimeout(() => setDisplayIntensity(intensity), 100);
      return () => clearTimeout(timer);
    }, [intensity]);

    // Compact mode for header display
    if (compact) {
      return (
        <motion.div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md ${className}`}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <PulsingDot color={zoneData.color} isActive={isActive} />
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: zoneData.color }}
          >
            {zoneData.labelHe}
          </span>
          <span className="text-white/60 text-xs">|</span>
          <span className="text-white text-xs font-bold tabular-nums">
            {Math.round(displayIntensity)}%
          </span>
        </motion.div>
      );
    }

    return (
      <motion.div
        className={`premium-card p-6 ${className}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 25 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <PulsingDot color={zoneData.color} isActive={isActive} />
            <span className="text-white/60 text-sm">עצימות אימון</span>
          </div>
          <motion.div
            className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
            style={{
              background: `${zoneData.color}20`,
              color: zoneData.color,
            }}
            key={zone}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            {zoneData.labelHe}
          </motion.div>
        </div>

        {/* Arc Gauge */}
        <div className="flex justify-center mb-4 relative">
          <ArcGauge intensity={displayIntensity} size={200} strokeWidth={16} />

          {/* Center value */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
            <motion.div
              className="text-5xl font-[800] tabular-nums"
              style={{ color: zoneData.color }}
              key={Math.round(displayIntensity)}
              initial={{ scale: 1.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              {Math.round(displayIntensity)}
              <span className="text-2xl">%</span>
            </motion.div>
          </div>
        </div>

        {/* Zone Bar */}
        <div className="mb-4">
          <ZoneBar intensity={displayIntensity} />
          <div className="flex justify-between mt-1 text-[10px] text-white/40 uppercase tracking-wider">
            <span>חימום</span>
            <span>שומן</span>
            <span>אירובי</span>
            <span>שיא</span>
            <span>מקס׳</span>
          </div>
        </div>

        {/* Volume Bar */}
        {showVolume && (
          <div className="pt-4 border-t border-white/10">
            <VolumeBar current={currentVolume} target={targetVolume} />
          </div>
        )}

        {/* Stats Row */}
        {totalSets > 0 && (
          <div className="flex justify-around pt-4 mt-4 border-t border-white/10">
            <div className="text-center">
              <div className="text-2xl font-bold text-white tabular-nums">
                {setsCompleted}
                <span className="text-white/40 text-lg">/{totalSets}</span>
              </div>
              <div className="text-xs text-white/60">סטים</div>
            </div>
            <div className="w-px bg-white/10" />
            <div className="text-center">
              <div className="text-2xl font-bold text-white tabular-nums">
                {currentVolume.toLocaleString()}
              </div>
              <div className="text-xs text-white/60">נפח (ק״ג)</div>
            </div>
            <div className="w-px bg-white/10" />
            <div className="text-center">
              <div className="text-2xl font-bold tabular-nums" style={{ color: zoneData.color }}>
                {Math.round(displayIntensity)}%
              </div>
              <div className="text-xs text-white/60">עצימות</div>
            </div>
          </div>
        )}
      </motion.div>
    );
  }
);

IntensityMeter.displayName = 'IntensityMeter';

export default IntensityMeter;
export { ZONES, getZoneFromIntensity, getZoneProgress };
