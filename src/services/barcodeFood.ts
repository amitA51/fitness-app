// ============================================================================
// barcodeFood — barcode scanning support + Open Food Facts lookup.
// ============================================================================
// Feeds the BarcodeScanner sheet in the Add-Meal flow. Detection uses the
// native BarcodeDetector API (Chrome/Android — the PWA's main target); the
// lookup maps an Open Food Facts per-100g product into the app's FoodItem
// shape so a scanned product behaves exactly like a library food (serving
// multiplier, macro math, save path).

import type { FoodItem } from '../types';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// BarcodeDetector feature detection (not yet in TS DOM lib — typed minimally)
// ---------------------------------------------------------------------------

/** Retail food barcode formats we accept. */
export const BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a'] as const;

export interface DetectedBarcode {
  rawValue: string;
  format: string;
}

export interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorCtor {
  new (options?: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats(): Promise<string[]>;
}

function getBarcodeDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined' || !('BarcodeDetector' in window)) return null;
  return (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
}

/**
 * True when the browser can camera-scan retail barcodes (BarcodeDetector
 * exists AND supports at least one EAN/UPC format). iOS Safari → false; the
 * scanner sheet then offers manual barcode entry only.
 */
export async function isBarcodeScanSupported(): Promise<boolean> {
  const ctor = getBarcodeDetectorCtor();
  if (!ctor) return false;
  try {
    const formats = await ctor.getSupportedFormats();
    return BARCODE_FORMATS.some((f) => formats.includes(f));
  } catch {
    return false;
  }
}

/** Build a detector limited to retail formats; null when unsupported. */
export function createBarcodeDetector(): BarcodeDetectorLike | null {
  const ctor = getBarcodeDetectorCtor();
  if (!ctor) return null;
  try {
    return new ctor({ formats: [...BARCODE_FORMATS] });
  } catch {
    return null;
  }
}

/** EAN-8 / UPC-A / EAN-13 (and GTIN-14) are 8–14 digits. */
export function isValidBarcode(code: string): boolean {
  return /^\d{8,14}$/.test(code.trim());
}

// ---------------------------------------------------------------------------
// Open Food Facts lookup
// ---------------------------------------------------------------------------

const OFF_BASE_URL = 'https://world.openfoodfacts.org/api/v2/product';
const OFF_FIELDS = 'product_name,product_name_he,nutriments,serving_size,brands';

export type BarcodeLookupResult =
  | { status: 'found'; food: FoodItem }
  | { status: 'not-found' }
  | { status: 'error' };

/** Read one per-100g nutriment; NaN / negative / non-numeric → null (rejected). */
function readNutriment(nutriments: Record<string, unknown>, key: string): number | null {
  const raw = nutriments[key];
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && raw.trim() !== ''
        ? Number(raw)
        : Number.NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function readName(product: Record<string, unknown>, key: string): string | null {
  const v = product[key];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/**
 * Map an Open Food Facts product payload to the app's FoodItem (per-100g
 * basis: servingSize "100ג", one serving = 100g — the standard library shape,
 * so the serving multiplier and calcFoodMacros work unchanged).
 *
 * Validation: calories (energy-kcal_100g) are REQUIRED — missing/NaN/negative
 * → null (treated as not-found). Other macros are rejected to 0 when invalid.
 */
export function mapOffProductToFood(barcode: string, product: unknown): FoodItem | null {
  if (!product || typeof product !== 'object') return null;
  const p = product as Record<string, unknown>;

  const nutriments =
    p.nutriments && typeof p.nutriments === 'object'
      ? (p.nutriments as Record<string, unknown>)
      : null;
  if (!nutriments) return null;

  const calories = readNutriment(nutriments, 'energy-kcal_100g');
  if (calories === null) return null;

  // Hebrew name first (Hebrew-first product), then the generic name.
  const name = readName(p, 'product_name_he') ?? readName(p, 'product_name') ?? `מוצר ${barcode}`;
  // OFF brands is a comma-separated list — keep the first one.
  const brand = readName(p, 'brands')?.split(',')[0]?.trim();

  const round1 = (n: number) => Math.round(n * 10) / 10;
  return {
    // Deterministic id: re-scanning the same product merges into one row
    // (handleAddFood dedupes by id and bumps servings).
    id: `off-${barcode}`,
    name,
    ...(brand ? { brand } : {}),
    calories: Math.round(calories),
    protein: round1(readNutriment(nutriments, 'proteins_100g') ?? 0),
    carbs: round1(readNutriment(nutriments, 'carbohydrates_100g') ?? 0),
    fat: round1(readNutriment(nutriments, 'fat_100g') ?? 0),
    fiber: round1(readNutriment(nutriments, 'fiber_100g') ?? 0),
    servingSize: '100ג',
    servings: 1,
    barcode,
  };
}

/**
 * Look up a barcode on Open Food Facts (free, no key).
 * - found      → mapped FoodItem
 * - not-found  → unknown product, or product without usable calorie data
 * - error      → network/HTTP failure (caller offers retry)
 */
export async function lookupBarcodeFood(barcode: string): Promise<BarcodeLookupResult> {
  const code = barcode.trim();
  if (!isValidBarcode(code)) return { status: 'not-found' };

  let response: Response;
  try {
    response = await fetch(`${OFF_BASE_URL}/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`);
  } catch (error) {
    logger.app.error('Barcode lookup network failure', error);
    return { status: 'error' };
  }

  // OFF answers unknown barcodes with HTTP 404 (+ status:0 body).
  if (response.status === 404) return { status: 'not-found' };
  if (!response.ok) {
    logger.app.error('Barcode lookup HTTP failure', { httpStatus: response.status });
    return { status: 'error' };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    logger.app.error('Barcode lookup returned invalid JSON', error);
    return { status: 'error' };
  }

  const envelope = data as { status?: unknown; product?: unknown } | null;
  if (!envelope || typeof envelope !== 'object') return { status: 'error' };
  if (envelope.status !== 1 || !envelope.product) return { status: 'not-found' };

  const food = mapOffProductToFood(code, envelope.product);
  return food ? { status: 'found', food } : { status: 'not-found' };
}
