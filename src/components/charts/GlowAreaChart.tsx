import { memo, useId, useMemo } from 'react';

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

  return (
    <div
      className="glass-surface scrim-noise"
      style={{
        position: 'relative',
        width: '100%',
        padding: '14px 12px 10px',
        borderRadius: '22px 16px 22px 16px',
      }}
    >
      <svg
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
        {areaPath && (
          <path
            d={areaPath}
            fill={`url(#${gradientId})`}
            style={{
              filter: `drop-shadow(0 6px 12px color-mix(in srgb, ${accent} 30%, transparent))`,
            }}
          />
        )}
        {linePath && (
          <path
            d={linePath}
            fill="none"
            stroke={`url(#${lineGradId})`}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
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
      </svg>
    </div>
  );
});
