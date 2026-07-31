import { describe, expect, it } from 'vitest';
import { EQUIPMENT_KEYS, translateEquipment } from './equipmentNames';

describe('translateEquipment', () => {
  it('maps every canonical key to a non-empty Hebrew label', () => {
    for (const key of EQUIPMENT_KEYS) {
      const label = translateEquipment(key);
      expect(label).toBeTruthy();
      // Hebrew label, never the raw English key.
      expect(label).not.toBe(key);
      expect(/[\u0590-\u05FF]/.test(label)).toBe(true);
    }
  });

  it('is case-insensitive', () => {
    expect(translateEquipment('Barbell')).toBe(translateEquipment('barbell'));
    expect(translateEquipment('DUMBBELL')).toBe('משקולת יד');
  });

  it('returns empty string for empty / nullish input', () => {
    expect(translateEquipment('')).toBe('');
    expect(translateEquipment(undefined)).toBe('');
    expect(translateEquipment(null)).toBe('');
  });

  it('passes through unknown non-empty values unchanged', () => {
    // Deliberately something the catalog does not model. `kettlebell` used to
    // stand in here and stopped being a valid example once it became a real
    // equipment type, so pick a value that will not graduate into the vocabulary.
    expect(translateEquipment('trapeze')).toBe('trapeze');
  });
});
