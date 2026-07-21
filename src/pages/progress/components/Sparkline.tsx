// ============================================================================
// Sparkline — a tiny, decorative trend glyph for master-list rows.
// ============================================================================
// Deliberately minimal: no axes, no interaction, no animation (the row already
// states the current value + delta in text, so this is aria-hidden). Draws
// oldest → newest left-to-right to match GlowAreaChart's convention across the
// app. Color is passed in from the row's zone grading (mint / warn / muted —
// never lime). Sub-two-point series render as a flat baseline so rows stay
// vertically aligned.

import { memo } from 'react';

interface SparklineProps {
  /** Series values, oldest → newest. */
  values: number[];
  width?: number;
  height?: number;
  /** Stroke + fill color (a tokenized `var(--fs-*)` string). */
  color?: string;
  strokeWidth?: number;
}

export const Sparkline = memo(function Sparkline({
  values,
  width = 60,
  height = 24,
  color = 'var(--fs-muted)',
  strokeWidth = 1.5,
}: SparklineProps) {
  const padY = strokeWidth + 1;

  if (values.length < 2) {
    // Flat baseline dash — keeps row rhythm when there's not enough to draw.
    const midY = height / 2;
    return (
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        style={{ display: 'block', overflow: 'visible' }}
      >
        <line
          x1={0}
          y1={midY}
          x2={width}
          y2={midY}
          stroke={color}
          strokeOpacity={0.4}
          strokeWidth={strokeWidth}
          strokeDasharray="2 3"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerH = height - padY * 2;
  const stepX = width / (values.length - 1);

  const pts = values.map((v, i) => ({
    x: i * stepX,
    y: padY + (1 - (v - min) / range) * innerH,
  }));

  const line = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
  const last = pts[pts.length - 1]!;
  const first = pts[0]!;
  const area = `${line} L ${last.x.toFixed(1)} ${height} L ${first.x.toFixed(1)} ${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <path d={area} fill={color} fillOpacity={0.12} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last.x} cy={last.y} r={strokeWidth + 0.6} fill={color} />
    </svg>
  );
});

export default Sparkline;
