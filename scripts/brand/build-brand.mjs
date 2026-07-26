/**
 * SparkOS brand asset generator.
 *
 * The mark and every letter of the wordmark are CONSTRUCTED from exact circular
 * arcs and straight lines on a shared grid (cap height 72, stroke 13), so the
 * geometry is reproducible rather than a pile of hand-tuned magic numbers.
 * Edit the constants here and re-run — never hand-edit the emitted SVGs.
 *
 *   node scripts/brand/build-brand.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PUB = join(ROOT, "public");
const BRAND = join(PUB, "brand");

/* ── grid ────────────────────────────────────────────────────────────────── */
const CAP = 72;   // cap height
const W = 13;     // stroke weight
const GAP = 15;   // the spark gap, in degrees of arc
const SHEAR = 13; // terminal shear, in degrees

/* brand tokens — mirrors src/styles/tokens.css */
const NAVY = "#16292d";     // --fs-primary
const MINT = "#43c7a5";     // --fs-accent (light)
const MINT_DARK = "#4ddcbb"; // --fs-accent (dark)
const OBSIDIAN = "#0d1516";  // --fs-rubber

/* ── primitives ──────────────────────────────────────────────────────────── */
const R = (d) => (d * Math.PI) / 180;
const n = (x) => +(Math.round(x * 100) / 100).toFixed(2).replace(/\.?0+$/, "");
const P = (cx, cy, r, deg) => [n(cx + r * Math.cos(R(deg))), n(cy + r * Math.sin(R(deg)))];

function ribbon(cx, cy, r, w, a0, a1, sh0 = 0, sh1 = 0) {
  const ro = r + w / 2, ri = r - w / 2;
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0, sweep = a1 > a0 ? 1 : 0;
  const o0 = P(cx, cy, ro, a0), o1 = P(cx, cy, ro, a1);
  const i1 = P(cx, cy, ri, a1 + sh1), i0 = P(cx, cy, ri, a0 + sh0);
  return `M${o0[0]} ${o0[1]}A${ro} ${ro} 0 ${large} ${sweep} ${o1[0]} ${o1[1]}` +
         `L${i1[0]} ${i1[1]}A${ri} ${ri} 0 ${large} ${sweep ? 0 : 1} ${i0[0]} ${i0[1]}Z`;
}
/* Inner ellipse is wound opposite to the outer one, so plain nonzero fill
   punches the counter — no fill-rule="evenodd" needed anywhere. */
const annulus = (cx, cy, rx, ry, w) => {
  const ox = rx + w / 2, oy = ry + w / 2, ix = rx - w / 2, iy = ry - w / 2;
  return `M${n(cx - ox)} ${cy}A${ox} ${oy} 0 1 1 ${n(cx + ox)} ${cy}A${ox} ${oy} 0 1 1 ${n(cx - ox)} ${cy}Z` +
         `M${n(cx - ix)} ${cy}A${ix} ${iy} 0 1 0 ${n(cx + ix)} ${cy}A${ix} ${iy} 0 1 0 ${n(cx - ix)} ${cy}Z`;
};
const bar = (x, y0, y1, w) => `M${n(x)} ${n(y0)}H${n(x + w)}V${n(y1)}H${n(x)}Z`;

// Diagonal cut HORIZONTALLY at both ends, so it sits flat on baseline/cap line.
function diag(x0, y0, x1, y1, w) {
  const h = (w * Math.hypot(x1 - x0, y1 - y0)) / (2 * Math.abs(y1 - y0));
  return `M${n(x0 - h)} ${n(y0)}L${n(x0 + h)} ${n(y0)}L${n(x1 + h)} ${n(y1)}L${n(x1 - h)} ${n(y1)}Z`;
}
const crossX = (ax, ay, bx, by, yc) => ax + ((bx - ax) * (yc - ay)) / (by - ay);

/* A horizontally-cut diagonal overhangs its endpoint by half the cut width, and
   that overhang depends on the slant, which depends on the endpoint. Solve the
   fixed point so outer edges land exactly on the advance (converges in ~3). */
function solveEnd(fixedX, fixedY, outerX, endY, w) {
  let h = w / 2;
  for (let i = 0; i < 5; i++) {
    const cx = outerX - h;
    h = (w * Math.hypot(cx - fixedX, endY - fixedY)) / (2 * Math.abs(endY - fixedY));
  }
  return outerX - h;
}

/* ── glyphs ──────────────────────────────────────────────────────────────── */
/** The S is the mark itself: two arcs of one circle radius, broken by the
 *  spark gap and cut on the shear angle. height = CAP, width = 2·rr + w. */
function glyphS({ x = 0, rr = 18, w = W, gap = GAP, shear = SHEAR } = {}) {
  const sep = CAP - 2 * rr - w;
  const cx = x + rr + w / 2, cyT = rr + w / 2, cyB = cyT + sep;
  return {
    d: ribbon(cx, cyT, rr, w, -37.6, -270 + gap, shear, -shear) +
       ribbon(cx, cyB, rr, w, -90 + gap, 142, -shear, shear),
    width: 2 * rr + w,
  };
}
function glyphO({ x = 0, w = W, width = 70 } = {}) {
  return { d: annulus(x + width / 2, CAP / 2, width / 2 - w / 2, CAP / 2 - w / 2, w), width };
}
function glyphP({ x = 0, w = W, bowlR = 17 } = {}) {
  const outer = bowlR + w / 2;
  return { d: bar(x, 0, CAP, w) + ribbon(x + w, outer, bowlR, w, -90, 90), width: w + outer };
}
function glyphR({ x = 0, w = W, bowlR = 17, width = 46 } = {}) {
  const outer = bowlR + w / 2, jx = x + w + 2, jy = 2 * outer - 3;
  return { d: glyphP({ x, w, bowlR }).d + diag(jx, jy, solveEnd(jx, jy, x + width, CAP, w), CAP, w), width };
}
/* Flat apex: diagonals aim at a virtual point ABOVE the cap line and are cut at
   y=0, so they overlap into a clean flat top instead of a Deco spike. */
function glyphA({ x = 0, w = W, width = 54, rise = 12 } = {}) {
  let h = w / 2, fl = x, fr = x + width, lx = x, rx = x + width;
  for (let i = 0; i < 5; i++) {
    fl = x + h; fr = x + width - h;
    const cx = (fl + fr) / 2;
    lx = crossX(cx, -rise, fl, CAP, 0);
    rx = crossX(cx, -rise, fr, CAP, 0);
    h = (w * Math.hypot(lx - fl, CAP)) / (2 * CAP);
  }
  const barY = CAP - 30;
  return {
    d: diag(lx, 0, fl, CAP, w) + diag(rx, 0, fr, CAP, w) +
       `M${n(x + 10)} ${n(barY)}H${n(x + width - 10)}V${n(barY + w)}H${n(x + 10)}Z`,
    width,
  };
}
function glyphK({ x = 0, w = W, width = 48, j = 33 } = {}) {
  const jx = x + w - 1;
  return {
    d: bar(x, 0, CAP, w) + diag(jx, j, solveEnd(jx, j, x + width, 0, w), 0, w) +
       diag(jx, j, solveEnd(jx, j, x + width, CAP, w), CAP, w),
    width,
  };
}

/* ── wordmark ────────────────────────────────────────────────────────────── */
// Optical side bearings: round and open letters need less air than flat ones.
const SEQ = [[glyphS, 9], [glyphP, 11], [glyphA, 7], [glyphR, 10], [glyphK, 7], [glyphO, 9], [glyphS, 0]];
function wordmark() {
  let x = 0, d = "";
  for (const [g, sb] of SEQ) {
    const gl = g({ x });
    d += gl.d;
    x += gl.width + sb;
  }
  return { d, width: x, height: CAP };
}

const MARK = glyphS();
const WORD = wordmark();

/* ── assembly ────────────────────────────────────────────────────────────── */
const svg = (vb, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" fill="none">\n  ${body}\n</svg>\n`;
const path = (d, fill) => `<path fill="${fill}" d="${d}"/>`;

/* horizontal lockup: mark set slightly taller than cap height, optically centred */
const MARK_H = 92, SCALE = MARK_H / CAP, GAP_X = 34;
const markW = MARK.width * SCALE;
const lockW = markW + GAP_X + WORD.width;
const lockup = (markFill, wordFill) =>
  svg(`0 0 ${n(lockW)} ${MARK_H}`,
    `<g transform="scale(${n(SCALE)})">${path(MARK.d, markFill)}</g>` +
    `<g transform="translate(${n(markW + GAP_X)} ${(MARK_H - CAP) / 2})">${path(WORD.d, wordFill)}</g>`);

/* stacked lockup */
const S_MARK_H = 124, S_SCALE = S_MARK_H / CAP, S_GAP = 30;
const sMarkW = MARK.width * S_SCALE;
const stacked = (markFill, wordFill) =>
  svg(`0 0 ${n(WORD.width)} ${S_MARK_H + S_GAP + CAP}`,
    `<g transform="translate(${n((WORD.width - sMarkW) / 2)} 0) scale(${n(S_SCALE)})">${path(MARK.d, markFill)}</g>` +
    `<g transform="translate(0 ${S_MARK_H + S_GAP})">${path(WORD.d, wordFill)}</g>`);

/* Square icon. `share` is the mark's height as a fraction of the canvas:
   0.62 for a normal icon, 0.52 for maskable so the mark clears Android's
   safe zone (the inner 80% circle) after the launcher crops it. */
function icon(size, bg, fg, share = 0.62) {
  const h = size * share, s = h / CAP, w = MARK.width * s;
  return svg(`0 0 ${size} ${size}`,
    `<rect width="${size}" height="${size}" fill="${bg}"/>` +
    `<g transform="translate(${n((size - w) / 2)} ${n((size - h) / 2)}) scale(${n(s)})">${path(MARK.d, fg)}</g>`);
}

/* ── emit ────────────────────────────────────────────────────────────────── */
mkdirSync(BRAND, { recursive: true });

/* currentColor files are for INLINING in JSX/HTML, where they inherit `color`.
   An <img> or CSS url() cannot inherit, and would render them black — so every
   mark ships fixed-colour siblings for that use. */
const out = {
  "brand/mark.svg":           svg(`0 0 ${MARK.width} ${CAP}`, path(MARK.d, "currentColor")),
  "brand/mark-navy.svg":      svg(`0 0 ${MARK.width} ${CAP}`, path(MARK.d, NAVY)),
  "brand/mark-mint.svg":      svg(`0 0 ${MARK.width} ${CAP}`, path(MARK.d, MINT_DARK)),
  "brand/mark-white.svg":     svg(`0 0 ${MARK.width} ${CAP}`, path(MARK.d, "#ffffff")),
  "brand/wordmark.svg":       svg(`0 0 ${n(WORD.width)} ${CAP}`, path(WORD.d, "currentColor")),
  "brand/wordmark-navy.svg":  svg(`0 0 ${n(WORD.width)} ${CAP}`, path(WORD.d, NAVY)),
  "brand/lockup.svg":         lockup("currentColor", "currentColor"),
  "brand/lockup-navy.svg":    lockup(NAVY, NAVY),
  "brand/lockup-white.svg":   lockup("#ffffff", "#ffffff"),
  "brand/lockup-duotone.svg": lockup(MINT, NAVY),
  "brand/lockup-stacked.svg": stacked("currentColor", "currentColor"),
  "brand/app-icon.svg":       icon(512, OBSIDIAN, MINT_DARK),
  "favicon.svg":              icon(64, OBSIDIAN, MINT_DARK),
  "logo.svg":                 lockup(NAVY, NAVY),
};
for (const [rel, body] of Object.entries(out)) {
  writeFileSync(join(PUB, rel), body);
  console.log("svg  ", rel.padEnd(28), `${body.length} B`);
}

/* raster icons */
const anySvg = Buffer.from(icon(512, OBSIDIAN, MINT_DARK, 0.62));
const maskSvg = Buffer.from(icon(512, OBSIDIAN, MINT_DARK, 0.52));
const rasters = [
  ["pwa-512x512.png", 512, anySvg], ["pwa-192x192.png", 192, anySvg],
  ["pwa-maskable-512x512.png", 512, maskSvg],
  ["apple-touch-icon.png", 180, anySvg],
  ["favicon-64.png", 64, anySvg], ["favicon-32.png", 32, anySvg],
];
await Promise.all(rasters.map(async ([name, px, src]) => {
  await sharp(src, { density: 512 }).resize(px, px).png({ compressionLevel: 9 }).toFile(join(PUB, name));
  console.log("png  ", name);
}));

console.log(`\nmark  ${MARK.width}x${CAP}   wordmark ${n(WORD.width)}x${CAP}   lockup ${n(lockW)}x${MARK_H}`);
