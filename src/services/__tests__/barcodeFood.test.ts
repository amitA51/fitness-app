import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidBarcode, lookupBarcodeFood, mapOffProductToFood } from '../barcodeFood';

const BARCODE = '7290000000001';

/** Minimal valid OFF product payload (per-100g basis). */
const validProduct = {
  product_name: 'Cottage Cheese',
  product_name_he: 'קוטג׳ 5%',
  brands: 'תנובה, Tnuva',
  nutriments: {
    'energy-kcal_100g': 98.4,
    proteins_100g: 11.2,
    carbohydrates_100g: 3.5,
    fat_100g: 5,
    fiber_100g: 0.4,
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isValidBarcode', () => {
  it('accepts EAN-8 / EAN-13 / GTIN-14 digit strings', () => {
    expect(isValidBarcode('12345678')).toBe(true);
    expect(isValidBarcode('7290000000001')).toBe(true);
    expect(isValidBarcode('12345678901234')).toBe(true);
  });

  it('rejects short, long, and non-numeric input', () => {
    expect(isValidBarcode('1234567')).toBe(false);
    expect(isValidBarcode('123456789012345')).toBe(false);
    expect(isValidBarcode('12345678a')).toBe(false);
    expect(isValidBarcode('')).toBe(false);
  });
});

describe('mapOffProductToFood', () => {
  it('maps a full product to the app FoodItem shape (per-100g serving)', () => {
    const food = mapOffProductToFood(BARCODE, validProduct);

    expect(food).toEqual({
      id: `off-${BARCODE}`,
      name: 'קוטג׳ 5%',
      brand: 'תנובה',
      calories: 98,
      protein: 11.2,
      carbs: 3.5,
      fat: 5,
      fiber: 0.4,
      servingSize: '100ג',
      servings: 1,
      barcode: BARCODE,
    });
  });

  it('prefers the Hebrew name and falls back to product_name, then the barcode', () => {
    const noHebrew = { ...validProduct, product_name_he: '' };
    expect(mapOffProductToFood(BARCODE, noHebrew)?.name).toBe('Cottage Cheese');

    const noName = { ...validProduct, product_name_he: undefined, product_name: '   ' };
    expect(mapOffProductToFood(BARCODE, noName)?.name).toBe(`מוצר ${BARCODE}`);
  });

  it('requires calories — missing/NaN/negative energy-kcal_100g rejects the product', () => {
    const missing = { ...validProduct, nutriments: { proteins_100g: 10 } };
    expect(mapOffProductToFood(BARCODE, missing)).toBeNull();

    const nan = { ...validProduct, nutriments: { 'energy-kcal_100g': 'abc' } };
    expect(mapOffProductToFood(BARCODE, nan)).toBeNull();

    const negative = { ...validProduct, nutriments: { 'energy-kcal_100g': -5 } };
    expect(mapOffProductToFood(BARCODE, negative)).toBeNull();
  });

  it('rejects invalid macro fields to 0 while keeping valid ones', () => {
    const food = mapOffProductToFood(BARCODE, {
      ...validProduct,
      nutriments: {
        'energy-kcal_100g': 100,
        proteins_100g: -3, // negative → rejected
        carbohydrates_100g: 'NaN-ish', // non-numeric → rejected
        fat_100g: '7.5', // numeric string → accepted
        // fiber missing → 0
      },
    });

    expect(food).not.toBeNull();
    expect(food?.protein).toBe(0);
    expect(food?.carbs).toBe(0);
    expect(food?.fat).toBe(7.5);
    expect(food?.fiber).toBe(0);
  });

  it('returns null for non-object payloads and products without nutriments', () => {
    expect(mapOffProductToFood(BARCODE, null)).toBeNull();
    expect(mapOffProductToFood(BARCODE, 'nope')).toBeNull();
    expect(mapOffProductToFood(BARCODE, { product_name: 'x' })).toBeNull();
  });

  it('omits brand when brands is missing', () => {
    const noBrand = { ...validProduct, brands: undefined };
    const food = mapOffProductToFood(BARCODE, noBrand);
    expect(food?.brand).toBeUndefined();
  });
});

describe('lookupBarcodeFood', () => {
  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status });

  it('returns found with the mapped food for a status:1 product', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 1, product: validProduct }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await lookupBarcodeFood(BARCODE);

    expect(result.status).toBe('found');
    if (result.status === 'found') {
      expect(result.food.name).toBe('קוטג׳ 5%');
      expect(result.food.calories).toBe(98);
    }
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/product/${BARCODE}.json?fields=`)
    );
  });

  it('returns not-found for HTTP 404 and for status:0 bodies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 0 }, 404)));
    expect((await lookupBarcodeFood(BARCODE)).status).toBe('not-found');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 0 })));
    expect((await lookupBarcodeFood(BARCODE)).status).toBe('not-found');
  });

  it('returns not-found when the product exists but has no usable calories', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ status: 1, product: { product_name: 'x', nutriments: {} } })
        )
    );

    expect((await lookupBarcodeFood(BARCODE)).status).toBe('not-found');
  });

  it('returns error for HTTP failures and network rejections', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    expect((await lookupBarcodeFood(BARCODE)).status).toBe('error');

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    expect((await lookupBarcodeFood(BARCODE)).status).toBe('error');
  });

  it('returns error for invalid JSON bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>not json</html>', { status: 200 }))
    );

    expect((await lookupBarcodeFood(BARCODE)).status).toBe('error');
  });

  it('short-circuits invalid barcodes without hitting the network', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    expect((await lookupBarcodeFood('abc')).status).toBe('not-found');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
