// ============================================================================
// GlowAreaChart — the y-span floor, pinned as geometry
// ----------------------------------------------------------------------------
// This chart backs six surfaces (ExerciseDetail strength curve, ForecastChart,
// BodyTab weight trend, Progress Workouts volume, Progress Overview, coach
// trends). It used to normalize every series to its own min-max, so an 80.0 ->
// 80.2 kg wobble drew the SAME full-height climb as 80 -> 95 kg. The rule now
// under test: the drawn y-span never shrinks below MIN_SPAN_FRACTION (10%) of
// the series' own mean, and a near-flat series is CENTRED inside that span.
//
// The four numbers asserted here were measured from the real rendered DOM in
// reports/visual-debt-qa-8e4d102.md (T-038) and are reproduced, not re-derived:
//   0.00%   — a 0.2 kg e1RM wobble (progressMetrics.ts quantizes e1RM to whole
//             kg, so the wobble reaches the chart as a constant series)
//   24.69%  — a realistic 2 kg bodyweight loss, mean 81 -> floor 8.1
//   100.00% — a genuine 80 -> 95 kg climb, floor inert
//   0.00%   — off-centre distance in every floored case
//
// HOW THIS TEST READS GEOMETRY. Everything is taken from the rendered SVG:
//   * the drawn line comes from the `d` of the stroked path;
//   * the inner band comes from the three gridlines the component itself draws
//     at 25% / 50% / 75% of that band.
// Nothing here re-implements computeYDomain/computePoints — a test that recomputed
// the formula would assert a copy of the decision instead of the decision.
// ============================================================================

import { render } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GlowAreaChart, type GlowAreaPoint } from './GlowAreaChart';

// Reduced motion is controllable per-test (the pattern SlideToComplete.test.tsx
// already uses). Mocking the hook instead of toggling the `reduce-motion` class
// keeps its MutationObserver out of the picture, so no state update lands
// outside act(). Default true = the calm path; the last test flips it to prove
// the geometry is identical while GSAP is animating.
let mockReducedMotion = true;
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
}));

// jsdom implements no SVG geometry API — a <path> is not even an SVGPathElement
// there — so the component's stroke-draw setup (getTotalLength ->
// strokeDashoffset) throws. Stub it on whatever prototype the created element
// has, the way this repo stubs Pointer Capture elsewhere. It feeds the dash
// animation only and cannot move a plotted point, so the geometry under test is
// untouched either way.
beforeAll(() => {
  const probe = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  if (!('getTotalLength' in probe)) {
    (Object.getPrototypeOf(probe) as { getTotalLength?: () => number }).getTotalLength = () => 100;
  }
});

beforeEach(() => {
  mockReducedMotion = true;
});

/** Both real callers render at height 170 (ExerciseDetail.tsx:267, TrendChartCard.tsx:30). */
const HEIGHT = 170;

/** Series values -> the {x,y} shape the chart takes, oldest -> newest. */
const series = (ys: number[]): GlowAreaPoint[] => ys.map((y, i) => ({ x: `d${i}`, y }));

interface Geometry {
  /** y of every plotted data point, in view units, oldest -> newest. */
  anchorYs: number[];
  /** Vertical extent of the drawn line as a % of the inner band. */
  extentPct: number;
  /** Distance from the line's mid-y to the band's mid-y, as a % of the band. */
  offCentrePct: number;
  bandTop: number;
  bandBottom: number;
}

/**
 * Pull the anchor points out of the path's `d`. buildSmoothPath emits
 * `M x y` followed by one `C c1x c1y, c2x c2y, x y` per segment, so every 6th
 * number after the first pair is a plotted point. The length assertions make a
 * change of path grammar fail loudly instead of silently mis-parsing.
 */
function anchorYsFromPath(d: string, expectedPoints: number): number[] {
  const nums = (d.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi) ?? []).map(Number);
  expect(nums.length).toBe(2 + (expectedPoints - 1) * 6);
  const ys = [nums[1] as number];
  for (let i = 2; i + 5 < nums.length; i += 6) ys.push(nums[i + 5] as number);
  expect(ys).toHaveLength(expectedPoints);
  return ys;
}

/** Render the chart and measure the drawn line against the band it drew. */
function measure(ys: number[], opts: { yAxis?: boolean } = {}): Geometry {
  const { container } = render(
    <GlowAreaChart data={series(ys)} height={HEIGHT} xAxis yAxis={opts.yAxis ?? false} />
  );

  // The band, read off the component's own 25/50/75% gridlines.
  const gridYs = Array.from(container.querySelectorAll('svg line'))
    .map((l) => Number(l.getAttribute('y1')))
    .sort((a, b) => a - b);
  expect(gridYs).toHaveLength(3);
  const [y25, y50, y75] = gridYs as [number, number, number];
  const bandHeight = (y75 - y25) / 0.5;
  const bandTop = y25 - 0.25 * bandHeight;
  // The middle gridline IS the band's mid-y; assert that before centring uses it.
  expect(y50).toBeCloseTo(bandTop + bandHeight / 2, 10);

  const linePath = container.querySelector('svg path[fill="none"]');
  expect(linePath).not.toBeNull();
  const anchorYs = anchorYsFromPath(linePath?.getAttribute('d') ?? '', ys.length);

  const lineTop = Math.min(...anchorYs);
  const lineBottom = Math.max(...anchorYs);
  return {
    anchorYs,
    extentPct: ((lineBottom - lineTop) / bandHeight) * 100,
    offCentrePct: (Math.abs((lineTop + lineBottom) / 2 - y50) / bandHeight) * 100,
    bandTop,
    bandBottom: bandTop + bandHeight,
  };
}

describe('GlowAreaChart y-span floor', () => {
  // --- 0.00%: the wobble that used to draw a full-height climb ---------------
  it('draws a 0.2 kg e1RM wobble flat — 0.00% of the inner band', () => {
    // progressMetrics.ts:370 rounds e1RM to whole kg, so 80.0 -> 80.2 reaches
    // the chart as a constant 80 series (the report's "quantized to 80" row).
    const { extentPct } = measure([80, 80, 80, 80, 80], { yAxis: true });
    expect(extentPct).toBeCloseTo(0, 2);
  });

  it('centres that flat series in the band — off-centre 0.00%', () => {
    const { offCentrePct, anchorYs, bandTop, bandBottom } = measure([80, 80, 80, 80, 80], {
      yAxis: true,
    });
    expect(offCentrePct).toBeCloseTo(0, 2);
    // Concretely: every point sits on the middle gridline, mid-card.
    for (const y of anchorYs) expect(y).toBeCloseTo((bandTop + bandBottom) / 2, 6);
  });

  // --- 24.69%: the floor scales the drawing instead of flattening it ---------
  it('draws a realistic 2 kg bodyweight loss at 24.69% of the band', () => {
    // 82.0 -> 80.0, mean exactly 81, so the floor is 8.1 and 2.0 / 8.1 = 24.69%.
    const { extentPct } = measure([82, 81.5, 81, 80.5, 80]);
    expect(extentPct).toBeCloseTo(24.69, 2);
  });

  it('scales floored series proportionally: 0.2 / 1 / 2 kg draw 1 : 5 : 10', () => {
    // Same mean (81) => same floor (8.1) for all three, so the only thing that
    // can move the extent is the real change. This is the property that
    // separates "floor" from "flatten", proven from rendered output alone.
    const wobble = measure([81.1, 81.05, 81, 80.95, 80.9]).extentPct;
    const oneKg = measure([81.5, 81.25, 81, 80.75, 80.5]).extentPct;
    const twoKg = measure([82, 81.5, 81, 80.5, 80]).extentPct;
    expect(twoKg / wobble).toBeCloseTo(10, 4);
    expect(twoKg / oneKg).toBeCloseTo(2, 4);
    expect(oneKg / wobble).toBeCloseTo(5, 4);
    // And none of them fills the card the way pure min-max did: the largest of
    // the family is the measured 24.69%, not 100%.
    for (const pct of [wobble, oneKg, twoKg]) expect(pct).toBeLessThanOrEqual(24.7);
  });

  it('centres the floored 2 kg series — off-centre 0.00%', () => {
    expect(measure([82, 81.5, 81, 80.5, 80]).offCentrePct).toBeCloseTo(0, 2);
  });

  it('centres an all-zero series (an untrained week) instead of pinning it low', () => {
    // Mean 0, so the floor falls back to a span of 1 rather than 10% of nothing,
    // and the row of zeroes lands mid-card. Pure min-max hit its zero-range
    // guard here and pinned every point to the bottom edge instead.
    const { extentPct, offCentrePct } = measure([0, 0, 0, 0]);
    expect(extentPct).toBeCloseTo(0, 2);
    expect(offCentrePct).toBeCloseTo(0, 2);
  });

  // --- 100.00%: a real climb is untouched by the floor -----------------------
  it('leaves a genuine 80 -> 95 kg climb filling the band — 100.00%', () => {
    // Range 15 >= floor 8.75 (mean 87.5), so the domain is the data range and
    // the endpoints land exactly on the band edges.
    const { extentPct, anchorYs, bandTop, bandBottom } = measure([80, 85, 90, 95], {
      yAxis: true,
    });
    expect(extentPct).toBeCloseTo(100, 2);
    expect(Math.min(...anchorYs)).toBeCloseTo(bandTop, 6);
    expect(Math.max(...anchorYs)).toBeCloseTo(bandBottom, 6);
  });

  // --- the geometry is not an animation artefact -----------------------------
  it('renders the same geometry with motion enabled', () => {
    const calm = measure([82, 81.5, 81, 80.5, 80]);
    mockReducedMotion = false;
    const animated = measure([82, 81.5, 81, 80.5, 80]);
    expect(animated.anchorYs).toEqual(calm.anchorYs);
    expect(animated.extentPct).toBeCloseTo(24.69, 2);
  });
});
