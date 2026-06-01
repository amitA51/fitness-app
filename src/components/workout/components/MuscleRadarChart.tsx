import { useReducedMotion } from '@/hooks/useReducedMotion';
import { EASE, gsap, useGSAP } from '@/lib/gsap';
import { motion } from 'framer-motion';
import type React from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

// Sonar sweep timing (seconds). Kept within ~1-1.4s for mid-range phones.
const ARM_DURATION = 1.0; // full rotation of the measuring arm
const VERTEX_DURATION = 0.5; // back.out pop per measured vertex
const LABEL_DURATION = 0.3; // label fade-in at its vertex
const LABEL_BASE_OPACITY = 0.8;

/**
 * MuscleRadarChart - SVG Radar chart showing muscle group balance.
 *
 * Entrance reads like sonar: a rotating sweep arm measures one muscle at a
 * time. As the arm reaches each vertex angle, that vertex interpolates its
 * radius from 0 to the data value (back.out), the polygon edge stroke draws
 * progressively (hand-rolled getTotalLength + strokeDashoffset), and the
 * matching dot + Hebrew label fade in place at that vertex.
 */
const MuscleRadarChart: React.FC<MuscleRadarChartProps> = ({
  data,
  size = 180,
  maxDisplay = 8,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const reduced = useReducedMotion();

  const rootRef = useRef<HTMLDivElement>(null);
  const polygonRef = useRef<SVGPolygonElement>(null);
  const sweepRef = useRef<SVGGElement>(null);
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const labelRefs = useRef<(SVGTextElement | null)[]>([]);
  const interactedRef = useRef(false);

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
  const getPoint = useCallback(
    (index: number, value: number): { x: number; y: number } => {
      const angle = index * angleStep - Math.PI / 2; // Start from top
      const normalizedValue = Math.min(value / 100, 1); // Normalize percentage to 0-1
      const r = radius * normalizedValue;
      return {
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle),
      };
    },
    [angleStep, radius, centerX, centerY]
  );

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

  // Build polygon path (final shape — used as SSR / reduced-motion fallback)
  const polygonPoints = useMemo(() => {
    return displayData
      .map((muscle, i) => {
        const point = getPoint(i, muscle.percentage);
        return `${point.x},${point.y}`;
      })
      .join(' ');
  }, [displayData, getPoint]);

  // Build background polygon (full radius)
  const backgroundPoints = useMemo(() => {
    return Array.from({ length: numPoints }, (_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
  }, [numPoints, angleStep, radius, centerX, centerY]);

  // Build axis lines
  const axisLines = useMemo(() => {
    return Array.from({ length: numPoints }, (_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const endX = centerX + radius * Math.cos(angle);
      const endY = centerY + radius * Math.sin(angle);
      return { x1: centerX, y1: centerY, x2: endX, y2: endY };
    });
  }, [numPoints, angleStep, radius, centerX, centerY]);

  // Get color for muscle status
  const getMuscleColor = (muscle: MuscleBalanceData): string => {
    if (muscle.isWeak) return MUSCLE_STATUS_COLORS.weak;
    if (muscle.trend === 'up') return MUSCLE_STATUS_COLORS.strong;
    if (muscle.trend === 'down') return MUSCLE_STATUS_COLORS.weak;
    return MUSCLE_STATUS_COLORS.stable;
  };

  // ---- Sonar measuring-sweep entrance (GSAP) -----------------------------
  // useGSAP must run before any early return to keep hook order stable.
  const { contextSafe } = useGSAP(
    () => {
      const polygon = polygonRef.current;
      if (!polygon || numPoints === 0) return;

      const dots = dotRefs.current;
      const labels = labelRefs.current;

      // Per-vertex final radius and an interpolator (0 -> target) per vertex.
      const targets = displayData.map((m) => radius * Math.min(m.percentage / 100, 1));
      const interps = targets.map((t) => gsap.utils.interpolate(0, t));

      // Mutable animation state: per-vertex eased progress + global stroke draw.
      const state = {
        progress: new Array<number>(numPoints).fill(0),
        draw: 0,
      };

      // Each frame: rebuild the polygon points from the current radii and
      // advance the hand-rolled stroke draw via getTotalLength.
      const render = (): void => {
        let pts = '';
        for (let i = 0; i < numPoints; i++) {
          const angle = i * angleStep - Math.PI / 2;
          const interp = interps[i];
          const r = interp ? interp(state.progress[i] ?? 0) : 0;
          const x = centerX + r * Math.cos(angle);
          const y = centerY + r * Math.sin(angle);
          pts += `${i === 0 ? '' : ' '}${x},${y}`;
        }
        polygon.setAttribute('points', pts);

        const len = polygon.getTotalLength();
        polygon.style.strokeDasharray = `${len}`;
        polygon.style.strokeDashoffset = `${len * (1 - state.draw)}`;
      };

      // Reduced motion: snap to final state, no tween / draw / sweep.
      if (reduced) {
        state.progress.fill(1);
        state.draw = 1;
        render();
        polygon.style.strokeDasharray = '';
        polygon.style.strokeDashoffset = '';
        dots.forEach((el) => el && gsap.set(el, { opacity: 1, scale: 1 }));
        labels.forEach((el) => el && gsap.set(el, { opacity: LABEL_BASE_OPACITY }));
        if (sweepRef.current) gsap.set(sweepRef.current, { opacity: 0 });
        return;
      }

      // Initial hidden state (runs in layout phase, before paint -> no flash).
      dots.forEach((el, i) => {
        const muscle = displayData[i];
        if (!el || !muscle) return;
        const p = getPoint(i, muscle.percentage);
        gsap.set(el, {
          opacity: 0,
          scale: 0,
          svgOrigin: `${p.x} ${p.y}`,
          transformOrigin: '50% 50%',
        });
      });
      labels.forEach((el) => el && gsap.set(el, { opacity: 0 }));
      if (sweepRef.current) gsap.set(sweepRef.current, { opacity: 0.55 });
      render();

      const tl = gsap.timeline({ onUpdate: render });

      // Sweep arm rotates a full turn, oldest -> newest (clockwise from top).
      if (sweepRef.current) {
        tl.fromTo(
          sweepRef.current,
          { rotation: 0 },
          {
            rotation: 360,
            svgOrigin: `${centerX} ${centerY}`,
            ease: 'none',
            duration: ARM_DURATION,
          },
          0
        );
        tl.to(sweepRef.current, { opacity: 0, duration: 0.25, ease: EASE.out }, ARM_DURATION);
      }

      // Stroke draws progressively in lockstep with the sweep arm.
      tl.to(state, { draw: 1, ease: 'none', duration: ARM_DURATION }, 0);

      // Each vertex measures itself as the arm reaches its angle.
      displayData.forEach((_, i) => {
        const start = (i / numPoints) * ARM_DURATION;
        tl.to(state.progress, { [i]: 1, ease: EASE.pop, duration: VERTEX_DURATION }, start);
        const dot = dots[i];
        if (dot) {
          tl.to(dot, { opacity: 1, scale: 1, ease: EASE.pop, duration: VERTEX_DURATION }, start);
        }
        const label = labels[i];
        if (label) {
          tl.to(
            label,
            { opacity: LABEL_BASE_OPACITY, ease: EASE.out, duration: LABEL_DURATION },
            start + 0.1
          );
        }
      });
    },
    { scope: rootRef, dependencies: [displayData, size, reduced] }
  );

  // Preserve the subtle label hover highlight without fighting the entrance
  // timeline (only engages once the user has actually hovered a vertex). Wrapped
  // in contextSafe so these tweens join the useGSAP context and revert on unmount.
  const applyHover = contextSafe((idx: number | null) => {
    labelRefs.current.forEach((el, i) => {
      if (!el) return;
      gsap.to(el, {
        opacity: idx === i ? 1 : LABEL_BASE_OPACITY,
        duration: 0.2,
        overwrite: 'auto',
      });
    });
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: applyHover is recreated each render (contextSafe wrapper); the effect is intentionally gated on hoveredIndex only.
  useEffect(() => {
    if (hoveredIndex !== null) interactedRef.current = true;
    if (!interactedRef.current) return;
    applyHover(hoveredIndex);
  }, [hoveredIndex]);

  return (
    <div
      ref={rootRef}
      className="relative magnetic-card glass-surface scrim-noise"
      style={{ padding: 16, borderRadius: '22px 16px 22px 16px' }}
      role="img"
      aria-label={
        displayData.length > 0
          ? `מפת איזון שרירים: ${displayData.map((m) => `${m.muscle} ${Math.round(m.percentage)}%`).join(', ')}`
          : 'מפת שרירים'
      }
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
        מפת שרירים
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

        {/* Sonar sweep arm — rotates from center, measuring one vertex at a time */}
        <g ref={sweepRef} style={{ opacity: 0 }}>
          <line
            x1={centerX}
            y1={centerY}
            x2={centerX}
            y2={centerY - radius}
            stroke="var(--fs-accent)"
            strokeOpacity={0.45}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <circle
            cx={centerX}
            cy={centerY - radius}
            r={2.5}
            fill="var(--fs-accent)"
            fillOpacity={0.8}
          />
        </g>

        {/* Data polygon — points + stroke draw are driven by GSAP each frame */}
        <polygon
          ref={polygonRef}
          points={polygonPoints}
          fill="color-mix(in srgb, var(--fs-accent) 22%, transparent)"
          stroke="var(--fs-accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          style={{
            filter: 'drop-shadow(0 6px 16px color-mix(in srgb, var(--fs-accent) 25%, transparent))',
          }}
        />

        {/* Data points */}
        {displayData.map((muscle, i) => {
          const point = getPoint(i, muscle.percentage);

          return (
            <circle
              key={muscle.muscle}
              ref={(el) => {
                dotRefs.current[i] = el;
              }}
              cx={point.x}
              cy={point.y}
              r={hoveredIndex === i ? 8 : 6}
              fill={getMuscleColor(muscle)}
              stroke="rgba(0, 0, 0, 0.3)"
              strokeWidth={2}
              style={{ cursor: 'pointer' }}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            />
          );
        })}

        {/* Center dot */}
        <circle cx={centerX} cy={centerY} r={3} fill="var(--fs-muted)" />

        {/* Labels — fade in place at their vertex (no translation, RTL-neutral) */}
        {displayData.map((muscle, i) => {
          const pos = getLabelPosition(i);
          const color = getMuscleColor(muscle);

          return (
            <text
              key={muscle.muscle}
              ref={(el) => {
                labelRefs.current[i] = el;
              }}
              x={pos.x}
              y={pos.y}
              textAnchor={pos.anchor as 'start' | 'middle' | 'end'}
              fontSize={9}
              fill={color}
              fontWeight="bold"
              fontFamily="var(--font-mono)"
              style={{ opacity: LABEL_BASE_OPACITY }}
            >
              {muscle.muscle.length > 8 ? `${muscle.muscle.slice(0, 7)}…` : muscle.muscle}
            </text>
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
