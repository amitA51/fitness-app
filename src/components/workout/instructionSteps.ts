// ============================================================================
// instructionSteps — segment a single exercise cue into ordered steps.
// ----------------------------------------------------------------------------
// Inspired by the "instruction_steps" shape common to public exercise datasets,
// but applied ONLY to our OWN authored Hebrew `tutorialText`. A terse cue like
//   "הורד מוט לאמצע החזה, דחוף למעלה בלי לנעול"
// is segmented into discrete steps the tutorial presents one at a time:
//   ["הורד מוט לאמצע החזה", "דחוף למעלה בלי לנעול"]
//
// Pure + dependency-free so it is trivially unit-testable. No external data or
// copyrighted text is involved — only our own catalog cues are ever passed in.
// ============================================================================

/** Sentence terminators + clause separators (Latin and Hebrew/Arabic). */
const SPLIT_RE = /[.!?;؛׃]+|[,،]/g;

/** Fragments shorter than this are folded into the previous step. */
const MIN_STEP_LEN = 6;

/** Hard cap so the step carousel stays digestible; overflow folds into the last. */
const MAX_STEPS = 6;

/**
 * Split a freeform instruction cue into clean, ordered execution steps.
 *
 * - Splits on sentence terminators (`. ! ? ;`) and clause commas (`,`).
 * - Trims fragments; drops empties and punctuation-only fragments.
 * - Folds a too-short trailing fragment (e.g. "וכו׳") into the previous step.
 * - Caps at {@link MAX_STEPS}; any overflow is merged into the final step.
 *
 * Returns `[]` for empty/blank input so callers can fall back gracefully.
 */
export function splitInstructionSteps(text?: string | null): string[] {
  if (!text) return [];
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const parts = normalized
    .split(SPLIT_RE)
    .map((part) => part.trim())
    // Keep only fragments that contain at least one letter or digit.
    .filter((part) => /[\p{L}\p{N}]/u.test(part));

  if (parts.length === 0) return [];

  // Fold short fragments into the preceding step (a stray "וכו׳" shouldn't be
  // its own bullet). A short FIRST fragment has nothing to merge into, so it
  // stays as step one.
  const merged: string[] = [];
  for (const part of parts) {
    const prev = merged.length - 1;
    if (merged.length > 0 && part.length < MIN_STEP_LEN) {
      merged[prev] = `${merged[prev]}, ${part}`;
    } else {
      merged.push(part);
    }
  }

  if (merged.length <= MAX_STEPS) return merged;

  // Collapse the overflow into the last step rather than truncating content.
  const head = merged.slice(0, MAX_STEPS - 1);
  const tail = merged.slice(MAX_STEPS - 1).join(', ');
  return [...head, tail];
}
