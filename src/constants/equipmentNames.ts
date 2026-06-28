// ============================================================================
// Equipment names — English catalog keys → Hebrew labels.
// ----------------------------------------------------------------------------
// The built-in exercise catalog tags each exercise with an English equipment
// key (barbell / dumbbell / cable / machine / bodyweight / plate). The app is
// Hebrew-first, so every user-facing surface resolves the key to a Hebrew label
// through here — the single source of truth (mirrors constants/muscleNames).
// ============================================================================

/** Canonical equipment keys used by the exercise catalog, in display order. */
export const EQUIPMENT_KEYS = [
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'bodyweight',
  'plate',
] as const;

export type EquipmentKey = (typeof EQUIPMENT_KEYS)[number];

// Natural Israeli-gym Hebrew terms (not literal translations): a barbell is a
// "מוט", a dumbbell a "משקולת יד", a cable station a "כבל", etc.
const EQUIPMENT_LABELS_HE: Record<string, string> = {
  barbell: 'מוט',
  dumbbell: 'משקולת יד',
  cable: 'כבל',
  machine: 'מכונה',
  bodyweight: 'משקל גוף',
  plate: 'פלטה',
};

/**
 * Hebrew label for an equipment key. Unknown but non-empty values pass through
 * unchanged (so user-authored equipment still shows); empty / nullish values
 * return '' so callers can simply skip rendering when there is nothing to show.
 */
export const translateEquipment = (key?: string | null): string => {
  if (!key) return '';
  return EQUIPMENT_LABELS_HE[key.toLowerCase()] ?? key;
};
