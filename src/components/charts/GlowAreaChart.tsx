import { useReducedMotion } from '@/hooks/useReducedMotion';
import { DUR, EASE, gsap, useGSAP } from '@/lib/gsap';
import type React from 'react';
import { memo, useCallback, useId, useMemo, useRef, useState } from 'react';

export interface GlowAreaPoint {
  x: string | number;
  y: number;
}

interface GlowAreaChartProps {
  data: GlowAreaPoint[];
  height?: number;
  accent?: string;
  accent2?: string;
  xAxis?: boolean;
  yAxis?: boolean;
  ariaLabel?: string;
  /**
   * Tap / scrub to inspect: on pointer move, hit-test to the nearest data point
   * and surface a vertical guide + dot + a tokenized callout (x label + y value).
   * The animated guide is skipped under reduced motion. Default false so every
   * existing static caller is unchanged.
   */
  interactive?: boolean;
  /** Optional unit suffix appended to the inspected y value in the callout (e.g. "kg"). */
  valueUnit?: string;
}

interface XY {
  x: number;
  y: number;
}

const VIEW_WIDTH = 600;
const PAD_X = 16;
const PAD_TOP = 14;
const PAD_BOTTOM_AXIS = 22;
const PAD_BOTTOM_NOAXIS = 10;

function computePoints(
  data: GlowAreaPoint[],
  height: number,
  showXAxis: boolean
): { points: XY[]; bottomY: number } {
  const padBottom = showXAxis ? PAD_BOTTOM_AXIS : PAD_BOTTOM_NOAXIS;
  const bottomY = height - padBottom;
  if (data.length === 0) return { points: [], bottomY };

  const ys = data.map((p) => p.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const range = max - min || 1;
  const innerW = VIEW_WIDTH - PAD_X * 2;
  const innerH = bottomY - PAD_TOP;
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((p, i) => {
    const normalized = (p.y - min) / range;
    return {
      x: PAD_X + i * stepX,
      y: PAD_TOP + (1 - normalized) * innerH,
    };
  });
  return { points, bottomY };
}

function buildSmoothPath(points: XY[]): string {
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

function pickXLabels(data: GlowAreaPoint[]): { label: string; index: number }[] {
  if (data.length === 0) return [];
  const targetCount = Math.min(5, data.length);
  if (data.length <= targetCount) {
    return data.map((p, i) => ({ label: String(p.x), index: i }));
  }
  const step = (data.length - 1) / (targetCount - 1);
  return Array.from({ length: targetCount }, (_, k) => {
    const idx = Math.round(k * step);
    return { label: String(data[idx]!.x), index: idx };
  });
}

export const GlowAreaChart = memo(function GlowAreaChart({
  data,
  height = 180,
  accent = 'var(--fs-accent)',
  accent2 = 'var(--fs-accent-2)',
  xAxis = false,
  yAxis = false,
  ariaLabel,
  interactive = false,
  valueUnit,
}: GlowAreaChartProps) {
  const reactId = useId();
  const gradientId = `glow-grad-${reactId}`;
  const lineGradId = `glow-line-${reactId}`;

  const { points, bottomY } = useMemo(
    () => computePoints(data, height, xAxis),
    [data, height, xAxis]
  );
  const linePath = useMemo(() => buildSmoothPath(points), [points]);
  const areaPath = useMemo(() => {
    if (points.length < 2) return '';
    const last = points[points.length - 1]!;
    const first = points[0]!;
    return `${linePath} L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;
  }, [linePath, points, bottomY]);

  const xLabels = useMemo(() => (xAxis ? pickXLabels(data) : []), [data, xAxis]);
  const ys = data.map((p) => p.y);
  const yMin = ys.length > 0 ? Math.min(...ys) : 0;
  const yMax = ys.length > 0 ? Math.max(...ys) : 0;
  const lastPoint = points.length > 0 ? points[points.length - 1]! : null;

  // Scrub-to-inspect: index of the data point under the pointer (null = idle).
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const reduced = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Map a clientX to the nearest data index using the SVG's own box (handles the
  // non-uniform preserveAspectRatio stretch). No-op when there is nothing to hit.
  const hitTest = useCallback(
    (clientX: number) => {
      const el = svgRef.current;
      if (!el || data.length === 0) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0) return;
      const fracView = ((clientX - rect.left) / rect.width) * VIEW_WIDTH;
      let nearest = 0;
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < points.length; i++) {
        const dx = Math.abs(points[i]!.x - fracView);
        if (dx < best) {
          best = dx;
          nearest = i;
        }
      }
      setActiveIdx(nearest);
    },
    [data.length, points]
  );

  const clearHit = useCallback(() => setActiveIdx(null), []);

  // Resolve the active point's geometry + label into the values the overlay needs.
  const active = useMemo(() => {
    if (activeIdx === null) return null;
    const pt = points[activeIdx];
    const datum = data[activeIdx];
    if (!pt || !datum) return null;
    return {
      leftPct: (pt.x / VIEW_WIDTH) * 100,
      topPct: (pt.y / height) * 100,
      label: String(datum.x),
      value: datum.y,
    };
  }, [activeIdx, points, data, height]);
  const linePathRef = useRef<SVGPathElement>(null);
  const areaPathRef = useRef<SVGPathElement>(null);
  const gridRef = useRef<SVGGElement>(null);
  const axisRef = useRef<SVGGElement>(null);
  const tailRef = useRef<SVGCircleElement>(null);

  useGSAP(
    () => {
      const lineEl = linePathRef.current;
      if (!lineEl) return;

      const areaEl = areaPathRef.current;
      const gridLines = gridRef.current ? Array.from(gridRef.current.children) : [];
      const axisLabels = axisRef.current
        ? Array.from(axisRef.current.querySelectorAll('text'))
        : [];
      const tailEl = tailRef.current;

      // Reduced motion: snap straight to the final composed state, no draw.
      if (reduced) {
        gsap.set(lineEl, {
          strokeDasharray: 'none',
          strokeDashoffset: 0,
          opacity: 1,
        });
        if (areaEl) gsap.set(areaEl, { opacity: 1 });
        if (gridLines.length) gsap.set(gridLines, { opacity: 1 });
        if (axisLabels.length) gsap.set(axisLabels, { opacity: 1 });
        if (tailEl) gsap.set(tailEl, { opacity: 1, scale: 1 });
        return;
      }

      // Hand-rolled stroke draw via getTotalLength + strokeDashoffset (no DrawSVG).
      const length = lineEl.getTotalLength();
      gsap.set(lineEl, {
        strokeDasharray: length,
        strokeDashoffset: length,
        opacity: 1,
      });
      if (areaEl) gsap.set(areaEl, { opacity: 0 });
      if (gridLines.length) gsap.set(gridLines, { opacity: 0 });
      if (axisLabels.length) gsap.set(axisLabels, { opacity: 0 });
      if (tailEl)
        gsap.set(tailEl, {
          opacity: 0,
          scale: 0,
          transformOrigin: '50% 50%',
        });

      const tl = gsap.timeline();
      // Gridlines stagger in underneath everything.
      if (gridLines.length) {
        tl.to(gridLines, { opacity: 1, duration: DUR.fast, stagger: 0.08, ease: EASE.out }, 0);
      }
      // Line draws oldest -> newest (path starts at the leftmost/oldest point).
      tl.to(lineEl, { strokeDashoffset: 0, duration: DUR.count, ease: EASE.reveal }, 0.05);
      // Gradient area fades in trailing the line.
      if (areaEl) {
        tl.to(areaEl, { opacity: 1, duration: DUR.base, ease: EASE.out }, 0.35);
      }
      // Axis labels fade last.
      if (axisLabels.length) {
        tl.to(axisLabels, { opacity: 1, duration: DUR.fast, stagger: 0.05, ease: EASE.out }, 0.7);
      }
      // Forecast tail point: pop in, then gentle infinite pulse.
      if (tailEl) {
        tl.to(tailEl, { opacity: 1, scale: 1, duration: DUR.fast, ease: EASE.pop }, 0.75);
        tl.to(
          tailEl,
          {
            scale: 1.55,
            opacity: 0.45,
            duration: DUR.slow,
            ease: 'sine.inOut',
            repeat: -1,
            yoyo: true,
            transformOrigin: '50% 50%',
          },
          '>'
        );
      }

      return () => {
        tl.kill();
      };
    },
    { scope: rootRef, dependencies: [linePath, reduced] }
  );

  const pointerHandlers = interactive
    ? {
        onPointerDown: (e: React.PointerEvent) => hitTest(e.clientX),
        onPointerMove: (e: React.PointerEvent) => {
          if (e.buttons > 0 || e.pointerType === 'mouse') hitTest(e.clientX);
        },
        onPointerLeave: clearHit,
        onPointerUp: clearHit,
        onPointerCancel: clearHit,
      }
    : {};

  return (
    <div
      ref={rootRef}
      className="glass-surface scrim-noise"
      style={{
        position: 'relative',
        width: '100%',
        padding: '14px 12px 10px',
        borderRadius: '22px 16px 22px 16px',
        touchAction: interactive ? 'pan-y' : undefined,
      }}
      {...pointerHandlers}
    >
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={ariaLabel ?? `area chart of ${data.length} points`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.55} />
            <stop offset="30%" stopColor={accent} stopOpacity={0.32} />
            <stop offset="100%" stopColor={accent2} stopOpacity={0} />
          </linearGradient>
          <linearGradient id={lineGradId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={accent2} />
            <stop offset="100%" stopColor={accent} />
          </linearGradient>
        </defs>
        <g ref={gridRef}>
          {[0.25, 0.5, 0.75].map((lvl) => {
            const y = PAD_TOP + lvl * (bottomY - PAD_TOP);
            return (
              <line
                key={lvl}
                x1={PAD_X}
                y1={y}
                x2={VIEW_WIDTH - PAD_X}
                y2={y}
                stroke="var(--fs-surface-2)"
                strokeOpacity={0.5}
                strokeWidth={1}
                strokeDasharray="3 4"
              />
            );
          })}
        </g>
        {areaPath && (
          <path
            ref={areaPathRef}
            d={areaPath}
            fill={`url(#${gradientId})`}
            style={{
              filter: `drop-shadow(0 6px 12px color-mix(in srgb, ${accent} 30%, transparent))`,
            }}
          />
        )}
        {linePath && (
          <path
            ref={linePathRef}
            d={linePath}
            fill="none"
            stroke={`url(#${lineGradId})`}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {lastPoint && (
          <circle
            ref={tailRef}
            cx={lastPoint.x}
            cy={lastPoint.y}
            r={3.5}
            fill={accent}
            style={{
              filter: `drop-shadow(0 0 6px color-mix(in srgb, ${accent} 70%, transparent))`,
            }}
          />
        )}
        {/* Scrub guide — a vertical rule under the inspected point. The SVG x
            stretches with the container (preserveAspectRatio="none") so it tracks
            the HTML overlay dot. The animated transition is dropped under reduced
            motion via the global reduced-motion rule + the no-transition guard. */}
        {active && (
          <line
            x1={points[activeIdx as number]!.x}
            x2={points[activeIdx as number]!.x}
            y1={PAD_TOP}
            y2={bottomY}
            stroke={accent}
            strokeWidth={1}
            strokeOpacity={0.5}
            strokeDasharray="2 3"
            style={reduced ? undefined : { transition: 'all 0.12s var(--ease-out, ease-out)' }}
          />
        )}
        <g ref={axisRef}>
          {yAxis && data.length > 0 && (
            <g>
              <text
                x={VIEW_WIDTH - PAD_X}
                y={PAD_TOP + 8}
                textAnchor="end"
                fontFamily="var(--font-mono)"
                fontSize={10}
                fill="var(--fs-ink)"
                fillOpacity={0.6}
              >
                {Math.round(yMax)}
              </text>
              <text
                x={VIEW_WIDTH - PAD_X}
                y={bottomY - 2}
                textAnchor="end"
                fontFamily="var(--font-mono)"
                fontSize={10}
                fill="var(--fs-ink)"
                fillOpacity={0.6}
              >
                {Math.round(yMin)}
              </text>
            </g>
          )}
          {xAxis &&
            xLabels.map((entry) => {
              const pt = points[entry.index];
              if (!pt) return null;
              return (
                <text
                  key={`${entry.label}-${entry.index}`}
                  x={pt.x}
                  y={height - 6}
                  textAnchor="middle"
                  fontFamily="var(--font-mono)"
                  fontSize={10}
                  fill="var(--fs-ink)"
                  fillOpacity={0.6}
                >
                  {entry.label}
                </text>
              );
            })}
        </g>
      </svg>
      {/* Inspect overlay — HTML (not SVG) so the dot stays a true circle and the
          mono callout renders with correct dir="ltr" digits despite the non-
          uniform SVG stretch. Purely positional → reduced-motion-safe. */}
      {interactive && active && (
        <div aria-hidden="true" style={{ position: 'absolute', inset: '14px 12px 10px' }}>
          {/* Dot */}
          <span
            style={{
              position: 'absolute',
              left: `${active.leftPct}%`,
              top: `${active.topPct}%`,
              width: 9,
              height: 9,
              transform: 'translate(-50%, -50%)',
              borderRadius: '9999px',
              background: accent,
              boxShadow: `0 0 6px color-mix(in srgb, ${accent} 70%, transparent)`,
            }}
          />
          {/* Callout bubble — clamped horizontally so it never clips the card. */}
          <div
            dir="ltr"
            style={{
              position: 'absolute',
              left: `clamp(0%, ${active.leftPct}%, 100%)`,
              top: 0,
              transform: `translateX(${active.leftPct > 65 ? '-100%' : active.leftPct < 35 ? '0%' : '-50%'})`,
              background: 'var(--fs-surface)',
              border: '1px solid var(--fs-surface-2)',
              borderRadius: 8,
              boxShadow: 'var(--shadow-card)',
              padding: '4px 8px',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              lineHeight: 1.4,
              color: 'var(--fs-ink)',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            <span style={{ color: 'var(--fs-muted)' }}>{active.label}</span>
            <br />
            <span style={{ fontWeight: 700 }}>
              {Math.round(active.value)}
              {valueUnit ? ` ${valueUnit}` : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
});
