// ============================================================================
// Cardio formatting — clock times, pace, distance, speed. Pure strings.
// ============================================================================
// Every value here renders LTR inside RTL text: callers wrap it in
// `.kinetic-number` or `dir="ltr"` (a bare "5:31" in a Hebrew line can reorder).
// Units use the Hebrew geresh/gershayim (׳ ״), never ASCII quotes.

import type { CardioActivity } from '../../types';
import { type PaceStyle, cardioActivityConfig } from './activities';
import { paceSecPerKm, speedKmh } from './math';

export const UNIT_KM = 'ק״מ';
export const UNIT_M = 'מ׳';
export const UNIT_PACE_KM = 'דק׳/ק״מ';
export const UNIT_SPEED = 'קמ״ש';
export const UNIT_PACE_500M = 'ל־500 מ׳';
export const UNIT_PACE_100M = 'ל־100 מ׳';
export const UNIT_BPM = 'דופק';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Seconds → "28:40" or "1:02:15". Negative/invalid → "0:00". */
export function formatClock(totalSec: number | null | undefined): string {
  const sec = Math.max(0, Math.round(Number.isFinite(totalSec) ? (totalSec as number) : 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/** Seconds-per-unit → "5:31". Null for no pace or a pace slower than an hour. */
export function formatPace(secPerUnit: number | null | undefined): string | null {
  if (secPerUnit == null || !Number.isFinite(secPerUnit) || secPerUnit <= 0) return null;
  const rounded = Math.round(secPerUnit);
  if (rounded >= 3600) return null;
  return `${Math.floor(rounded / 60)}:${pad2(rounded % 60)}`;
}

/** Kilometres → "5.21", "5.2", "12" (two decimals, trailing zeros dropped). */
export function formatKm(km: number | null | undefined): string {
  if (km == null || !Number.isFinite(km) || km <= 0) return '0';
  return String(Number(km.toFixed(2)));
}

/** Metres → "1,500". */
export function formatMeters(m: number | null | undefined): string {
  if (m == null || !Number.isFinite(m) || m <= 0) return '0';
  return Math.round(m).toLocaleString('en-US');
}

/** km/h → "24.3". */
export function formatSpeed(kmh: number | null | undefined): string | null {
  if (kmh == null || !Number.isFinite(kmh) || kmh <= 0) return null;
  return kmh.toFixed(1);
}

/** A number with its unit, kept apart so the number can render LTR. */
export interface ValueWithUnit {
  value: string;
  unit: string;
}

/** Distance in the activity's own unit: "5.21 ק״מ" or "1,500 מ׳". */
export function cardioDistance(
  activity: CardioActivity,
  distanceKm: number | null | undefined
): ValueWithUnit | null {
  if (distanceKm == null || !Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  return cardioActivityConfig(activity).distanceUnit === 'm'
    ? { value: formatMeters(distanceKm * 1000), unit: UNIT_M }
    : { value: formatKm(distanceKm), unit: UNIT_KM };
}

/** Speed written the activity's way — pace, km/h, per 500 m or per 100 m. */
export function cardioPace(
  activity: CardioActivity,
  distanceKm: number | null | undefined,
  durationSec: number | null | undefined
): ValueWithUnit | null {
  return paceByStyle(cardioActivityConfig(activity).paceStyle, distanceKm, durationSec);
}

export function paceByStyle(
  style: PaceStyle,
  distanceKm: number | null | undefined,
  durationSec: number | null | undefined
): ValueWithUnit | null {
  const perKm = paceSecPerKm(distanceKm, durationSec);
  switch (style) {
    case 'per_km': {
      const value = formatPace(perKm);
      return value ? { value, unit: UNIT_PACE_KM } : null;
    }
    case 'speed': {
      const value = formatSpeed(speedKmh(distanceKm, durationSec));
      return value ? { value, unit: UNIT_SPEED } : null;
    }
    case 'per_500m': {
      const value = formatPace(perKm === null ? null : perKm / 2);
      return value ? { value, unit: UNIT_PACE_500M } : null;
    }
    case 'per_100m': {
      const value = formatPace(perKm === null ? null : perKm / 10);
      return value ? { value, unit: UNIT_PACE_100M } : null;
    }
    default:
      return null;
  }
}

/**
 * Parse a typed clock — "28:40", "1:02:15", or a bare number of minutes
 * ("45") — into seconds. Null for anything unreadable.
 */
export function parseClock(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (/^\d+([.,]\d+)?$/.test(trimmed)) {
    const minutes = Number(trimmed.replace(',', '.'));
    return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null;
  }
  const parts = trimmed.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const nums = parts.map(Number);
  const [a, b, c] = nums as [number, number, number | undefined];
  if (c === undefined) {
    if (b >= 60) return null;
    const total = a * 60 + b;
    return total > 0 ? total : null;
  }
  if (b >= 60 || c >= 60) return null;
  const total = a * 3600 + b * 60 + c;
  return total > 0 ? total : null;
}

/** Parse a typed decimal ("5.2" or "5,2"). Null for empty / non-positive. */
export function parseDecimal(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null;
}
