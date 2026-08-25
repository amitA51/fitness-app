// workoutShareCard — renders the workout summary as a shareable image
// (Strava/Fitness-Wrapped pattern: the session's stats become a designed
// graphic users can post, not a bare text receipt).
//
// Pure canvas composition — no html2canvas/DOM rasterization — so the output
// is crisp at 2x and carries zero layout risk. Fresh Steel tokens are read
// live from :root with hardcoded fallbacks so an off-theme render still looks
// on-brand. Fonts are awaited BEFORE any drawImage/fillText: an un-loaded web
// font silently falls back on canvas (unlike HTML), which is the classic
// broken-share-image bug.
import type { PersonalItem } from '../types';

export interface WorkoutShareStats {
  totalVolume: number;
  totalSets: number;
  durationSec: number;
  prsCount: number;
}

/** 4:5 portrait — fills Instagram/Twitter/Status previews without letterboxing. */
const CARD_W = 1080;
const CARD_H = 1350;

function readToken(name: string, fallback: string): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

async function ensureFonts(): Promise<void> {
  try {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts?.load) return;
    // Hebrew sample text forces the Hebrew glyph subset to load too.
    await Promise.all([
      fonts.load('800 220px Assistant', 'אימון 12'),
      fonts.load('700 72px Assistant', 'אימון 12'),
      fonts.load('600 44px Assistant', 'ק"ג נפח'),
    ]);
    await fonts.ready;
  } catch {
    // Font API unavailable/blocked → system fallback still renders legibly.
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = Number.parseInt(m[1] ?? '000000', 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * Renders the share card. Returns null when canvas is unavailable (tests,
 * exotic webviews) — callers must treat null as "fall back to text share".
 */
export async function renderWorkoutShareCard(
  stats: WorkoutShareStats,
  opts?: { date?: Date }
): Promise<HTMLCanvasElement | null> {
  if (typeof document === 'undefined') return null;
  try {
    await ensureFonts();

    const accent = readToken('--fs-accent', '#43c7a5');
    const ink = readToken('--color-ink-on-dark', '#f5f7fa');
    const muted = readToken('--fs-muted', '#a3a3a3');
    const bg = readToken('--fs-bg-dark', '#111111');

    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // ── Background: near-black + one soft mint glow from the top ──────────
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, CARD_W, CARD_H);
    const glow = ctx.createRadialGradient(CARD_W / 2, 140, 60, CARD_W / 2, 140, 760);
    glow.addColorStop(0, hexToRgba(accent, 0.18));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    ctx.direction = 'rtl';
    ctx.textAlign = 'center';

    // ── Kicker + date ─────────────────────────────────────────────────────
    ctx.fillStyle = accent;
    ctx.font = '700 46px Assistant, system-ui, sans-serif';
    ctx.fillText('סיכום אימון', CARD_W / 2, 216);

    ctx.fillStyle = muted;
    ctx.font = '600 38px Assistant, system-ui, sans-serif';
    const date = opts?.date ?? new Date();
    let dateLine = '';
    try {
      dateLine = new Intl.DateTimeFormat('he-IL', { dateStyle: 'long' }).format(date);
    } catch {
      dateLine = date.toLocaleDateString();
    }
    ctx.fillText(dateLine, CARD_W / 2, 280);

    // ── Hero: total volume (the number lifters brag about) ────────────────
    ctx.fillStyle = ink;
    ctx.font = '800 224px Assistant, system-ui, sans-serif';
    ctx.fillText(stats.totalVolume.toLocaleString('he-IL'), CARD_W / 2, 520);

    ctx.fillStyle = muted;
    ctx.font = '600 46px Assistant, system-ui, sans-serif';
    ctx.fillText('ק"ג נפח כולל', CARD_W / 2, 592);

    // Hairline divider
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(CARD_W / 2 - 160, 664, 320, 3);

    // ── Secondary pair (RTL reading order: right first = sets) ────────────
    const minutes = Math.max(1, Math.round(stats.durationSec / 60));
    const cols: Array<{ x: number; value: string; label: string }> = [
      { x: CARD_W / 2 + 260, value: String(stats.totalSets), label: 'סטים' },
      { x: CARD_W / 2 - 260, value: `${minutes}`, label: 'דקות' },
    ];
    for (const col of cols) {
      ctx.fillStyle = ink;
      ctx.font = '800 112px Assistant, system-ui, sans-serif';
      ctx.fillText(col.value, col.x, 852);
      ctx.fillStyle = muted;
      ctx.font = '600 42px Assistant, system-ui, sans-serif';
      ctx.fillText(col.label, col.x, 920);
    }

    // ── PR chip (only when there is something to celebrate) ───────────────
    if (stats.prsCount > 0) {
      const label = stats.prsCount === 1 ? 'שיא אישי חדש' : `${stats.prsCount} שיאים אישיים חדשים`;
      ctx.font = '700 50px Assistant, system-ui, sans-serif';
      const tw = ctx.measureText(label).width;
      const padX = 56;
      const boxW = tw + padX * 2;
      const boxH = 104;
      const bx = (CARD_W - boxW) / 2;
      const by = 1020;
      ctx.fillStyle = hexToRgba(accent, 0.14);
      roundRect(ctx, bx, by, boxW, boxH, boxH / 2);
      ctx.fill();
      ctx.strokeStyle = hexToRgba(accent, 0.55);
      ctx.lineWidth = 3;
      roundRect(ctx, bx, by, boxW, boxH, boxH / 2);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.textBaseline = 'middle';
      ctx.fillText(label, CARD_W / 2, by + boxH / 2 + 2);
      ctx.textBaseline = 'alphabetic';
    }

    // ── Footer ────────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '600 38px Assistant, system-ui, sans-serif';
    ctx.fillText('SparkOS', CARD_W / 2, 1256);

    return canvas;
  } catch {
    return null;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), 'image/png');
    } catch {
      resolve(null);
    }
  });
}

/**
 * Outcome of an image-share attempt. Only `unsupported` should trigger a
 * text-share fallback — after `cancelled` popping another share sheet would
 * be hostile (the user just dismissed one).
 */
export type ShareCardResult = 'shared' | 'cancelled' | 'unsupported';

/**
 * Try to share the summary as an IMAGE (Strava pattern). Never throws.
 */
export async function shareWorkoutCard(
  stats: WorkoutShareStats,
  _item?: PersonalItem
): Promise<ShareCardResult> {
  if (typeof navigator === 'undefined' || !navigator.share) return 'unsupported';
  const canShareFiles =
    typeof navigator.canShare === 'function' &&
    (() => {
      try {
        return navigator.canShare({ files: [new File([], 'x.png')] });
      } catch {
        return false;
      }
    })();
  if (!canShareFiles) return 'unsupported';

  const canvas = await renderWorkoutShareCard(stats);
  if (!canvas) return 'unsupported';
  const blob = await canvasToBlob(canvas);
  if (!blob) return 'unsupported';

  try {
    const file = new File([blob], 'workout-summary.png', { type: 'image/png' });
    await navigator.share({
      files: [file],
      title: 'סיכום אימון',
    });
    return 'shared';
  } catch {
    // User-cancel also rejects here — report cancelled so the caller doesn't
    // immediately re-open a second share sheet with the text fallback.
    return 'cancelled';
  }
}
