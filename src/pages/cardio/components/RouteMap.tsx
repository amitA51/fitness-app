import { memo, useMemo } from 'react';

interface RouteMapProps {
  points: readonly [number, number][];
  /** Accessible description. */
  label: string;
  height?: number;
}

const PAD = 12;
const WIDTH = 320;

/**
 * The route's shape as an SVG line — no map tiles, so nothing is fetched from a
 * third party and nothing about where the user runs leaves the device. North is
 * up and east is right; geography does not mirror in RTL, so the SVG is LTR.
 */
export const RouteMap = memo(function RouteMap({ points, label, height = 200 }: RouteMapProps) {
  const path = useMemo(() => {
    if (points.length < 2) return null;
    const lat0 = points.reduce((s, p) => s + p[0], 0) / points.length;
    const kx = Math.cos((lat0 * Math.PI) / 180);
    const xs = points.map((p) => p[1] * kx);
    const ys = points.map((p) => p[0]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const spanX = maxX - minX || 1e-9;
    const spanY = maxY - minY || 1e-9;
    const scale = Math.min((WIDTH - 2 * PAD) / spanX, (height - 2 * PAD) / spanY);
    const offX = (WIDTH - spanX * scale) / 2;
    const offY = (height - spanY * scale) / 2;
    const coords = points.map((_, i) => {
      const x = offX + ((xs[i] as number) - minX) * scale;
      const y = height - (offY + ((ys[i] as number) - minY) * scale);
      return [x, y] as const;
    });
    return {
      d: coords
        .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
        .join(' '),
      start: coords[0] as readonly [number, number],
      end: coords[coords.length - 1] as readonly [number, number],
    };
  }, [points, height]);

  if (!path) return null;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label={label}
      style={{
        display: 'block',
        direction: 'ltr',
        borderRadius: 16,
        background: 'var(--fs-surface-2)',
      }}
    >
      <path
        d={path.d}
        fill="none"
        stroke="var(--fs-accent)"
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={path.start[0]}
        cy={path.start[1]}
        r={6}
        fill="var(--fs-surface)"
        stroke="var(--fs-accent-2)"
        strokeWidth={3}
      />
      <circle cx={path.end[0]} cy={path.end[1]} r={6} fill="var(--fs-accent-2)" />
    </svg>
  );
});
