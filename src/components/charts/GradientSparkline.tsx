import { useReducedMotion } from '@/hooks/useReducedMotion';
import { DUR, EASE, gsap, useGSAP } from '@/lib/gsap';
import { memo, useId, useMemo, useRef } from 'react';

// Line draw-on duration (seconds). Uses the shared DUR.count token so this
// matches GlowAreaChart's line draw — both chart surfaces draw at one speed.
const LINE_DRAW_DURATION = DUR.count;

interface GradientSparklineProps {
  data: number[];
  width?: number;
  height?: number;
  accent?: string;
  showArea?: boolean;
  ariaLabel?: string;
  live?: boolean;
}

interface PointXY {
  x: number;
  y: number;
}

function buildPoints(data: number[], width: number, height: number, padding: number): PointXY[] {
  if (data.length === 0) return [];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;
  return data.map((v, i) => {
    const normalized = (v - min) / range;
    return {
      x: padding + i * stepX,
      y: padding + (1 - normalized) * innerH,
    };
  });
}

// Smoothed cubic-bezier path using simple averaging of neighbors.
function buildSmoothPath(points: PointXY[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0]!;
    return `M ${p.x} ${p.y}`;
  }
  const first = points[0]!;
  let path = `M ${first.x} ${first.y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1]!;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

export const GradientSparkline = memo(function GradientSparkline({
  data,
  width = 200,
  height = 60,
  accent = 'var(--fs-accent)',
  showArea = true,
  ariaLabel,
  live = false,
}: GradientSparklineProps) {
  const reactId = useId();
  const gradientId = `spark-grad-${reactId}`;
  const glowId = `spark-glow-${reactId}`;
  const padding = 4;

  const points = useMemo(() => buildPoints(data, width, height, padding), [data, width, height]);
  const linePath = useMemo(() => buildSmoothPath(points), [points]);

  const areaPath = useMemo(() => {
    if (points.length < 2) return '';
    const last = points[points.length - 1]!;
    const first = points[0]!;
    const bottomY = height - padding;
    return `${linePath} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;
  }, [linePath, points, height]);

  const endPoint = points[points.length - 1];
  const prefersReduced = useReducedMotion();

  const rootRef = useRef<SVGSVGElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const areaRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);

  // Draw the line on mount via hand-rolled strokeDashoffset (no DrawSVGPlugin),
  // fade the gradient fill in trailing the line, then pop the end dot.
  // SVG viewBox space draws oldest -> newest; not mirrored for RTL.
  useGSAP(
    () => {
      const line = lineRef.current;
      const area = areaRef.current;
      const dot = dotRef.current;

      // Reduced motion: snap to final visible state, no tween.
      if (prefersReduced) {
        if (line) gsap.set(line, { strokeDasharray: 'none', strokeDashoffset: 0 });
        if (area) gsap.set(area, { opacity: 1 });
        if (dot) gsap.set(dot, { scale: 1, opacity: 1 });
        return;
      }

      if (!line) return;

      const length = line.getTotalLength();
      gsap.set(line, { strokeDasharray: length, strokeDashoffset: length });
      if (area) gsap.set(area, { opacity: 0 });
      if (dot) gsap.set(dot, { scale: 0, opacity: 0, transformOrigin: 'center center' });

      const tl = gsap.timeline();
      tl.to(line, {
        strokeDashoffset: 0,
        duration: LINE_DRAW_DURATION,
        ease: EASE.reveal,
      });
      if (area) {
        // Trail the line: start the fill fade-in partway through the draw.
        tl.to(area, { opacity: 1, duration: DUR.base, ease: EASE.out }, LINE_DRAW_DURATION * 0.45);
      }
      if (dot) {
        // Pop the end/last point at the end of the draw.
        tl.to(dot, { scale: 1, opacity: 1, duration: DUR.fast, ease: EASE.pop }, '>-0.05');
      }
    },
    { scope: rootRef, dependencies: [linePath, areaPath, prefersReduced] }
  );

  if (data.length === 0) {
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={ariaLabel ?? 'sparkline'}
      />
    );
  }

  return (
    <svg
      ref={rootRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel ?? `sparkline of ${data.length} points`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity={0.45} />
          <stop offset="100%" stopColor={accent} stopOpacity={0} />
        </linearGradient>
        <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor={accent} floodOpacity="0.35" />
        </filter>
      </defs>
      {showArea && areaPath && <path ref={areaRef} d={areaPath} fill={`url(#${gradientId})`} />}
      {linePath && (
        <path
          ref={lineRef}
          d={linePath}
          fill="none"
          stroke={accent}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter={`url(#${glowId})`}
        />
      )}
      {endPoint && (
        <g>
          <circle ref={dotRef} cx={endPoint.x} cy={endPoint.y} r={3.5} fill={accent} />
          {live && !prefersReduced && (
            <circle
              cx={endPoint.x}
              cy={endPoint.y}
              r={3.5}
              fill="none"
              stroke={accent}
              strokeOpacity={0.6}
            >
              <animate attributeName="r" from="3.5" to="8" dur="1.6s" repeatCount="indefinite" />
              <animate
                attributeName="stroke-opacity"
                from="0.6"
                to="0"
                dur="1.6s"
                repeatCount="indefinite"
              />
            </circle>
          )}
        </g>
      )}
    </svg>
  );
});
