// AlternativesSheet — pick an alternative exercise, built on the foundation
// <Sheet>. Two ways in: the program's preset substitutions (similar movements),
// or "בחר מהספרייה" which opens the full exercise library (built-ins + custom)
// so any movement can be swapped in. Tapping a choice fires the right callback
// then closes.

import { m } from 'framer-motion';
import { ChevronRight, Library } from 'lucide-react';
import { memo, useCallback, useState } from 'react';
import { useHapticFeedback } from '../../../hooks/useHapticFeedback';
import type { PersonalExercise } from '../../../types';
import { Sheet } from '../../ui/Sheet';
import ExerciseLibraryTab from '../ExerciseLibraryTab';

interface AlternativesSheetProps {
  isOpen: boolean;
  alternatives: string[];
  exerciseName: string;
  /** Swap to a preset substitution (name only — keeps the original targeting). */
  onSelect?: (altName: string) => void;
  /** Swap to ANY library exercise (built-in or custom); carries its muscles. */
  onSelectFromLibrary?: (exercise: PersonalExercise) => void;
  onClose: () => void;
}

const AlternativesSheet = memo<AlternativesSheetProps>(
  ({ isOpen, alternatives, exerciseName, onSelect, onSelectFromLibrary, onClose }) => {
    const haptics = useHapticFeedback();
    const [showLibrary, setShowLibrary] = useState(false);

    // Always reopen on the presets view; reset when the sheet dismisses.
    const handleClose = useCallback(() => {
      setShowLibrary(false);
      onClose();
    }, [onClose]);

    const handleSelect = useCallback(
      (name: string) => {
        haptics.selection();
        onSelect?.(name);
        handleClose();
      },
      [onSelect, handleClose, haptics]
    );

    const handleLibraryPick = useCallback(
      (exercise: PersonalExercise) => {
        haptics.selection();
        onSelectFromLibrary?.(exercise);
        handleClose();
      },
      [onSelectFromLibrary, handleClose, haptics]
    );

    return (
      <Sheet
        isOpen={isOpen}
        onClose={handleClose}
        title={showLibrary ? 'בחירת תרגיל מהספרייה' : 'תרגילים חלופיים'}
        ariaLabel={showLibrary ? 'בחירת תרגיל מהספרייה' : `תרגילים חלופיים ל${exerciseName}`}
      >
        {showLibrary ? (
          // Library mode — the full picker (built-ins + custom) in a bounded
          // box so its own list scrolls inside the sheet. Selection mode hides
          // the per-card delete; a tap swaps immediately.
          <div style={{ display: 'flex', flexDirection: 'column', height: '58vh', minHeight: 0 }}>
            <button
              type="button"
              onClick={() => setShowLibrary(false)}
              className="inline-flex items-center gap-1 self-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
              style={{
                marginBottom: 10,
                padding: '6px 4px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--fs-accent-2)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              <ChevronRight size={16} aria-hidden="true" />
              חזרה לחלופות
            </button>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <ExerciseLibraryTab isSelectionMode onSelect={handleLibraryPick} />
            </div>
          </div>
        ) : (
          <>
            <p
              className="text-xs"
              style={{ color: 'var(--fs-muted)', marginBottom: 12, textAlign: 'start' }}
            >
              במקום {exerciseName}
            </p>

            {alternatives.length > 0 ? (
              <div className="space-y-2">
                {alternatives.map((alt, idx) => (
                  <m.button
                    key={alt}
                    type="button"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelect(alt)}
                    className="
                      w-full min-h-[44px] flex items-center gap-3 p-4
                      bg-[var(--fs-surface-2)] border border-[var(--color-border)]
                      hover:bg-[var(--fs-plate)] hover:border-[var(--fs-accent)]/40
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fs-surface)]
                      transition-ui group
                    "
                    style={{ borderRadius: 'var(--radius-asymmetric)', textAlign: 'start' }}
                  >
                    {/* Number */}
                    <div className="w-8 h-8 rounded-full bg-[var(--fs-accent)]/12 border border-[var(--fs-accent)]/30 flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--fs-accent)]/24 transition-colors">
                      <span className="text-xs font-bold text-[var(--fs-accent-2)]">{idx + 1}</span>
                    </div>

                    {/* Name */}
                    <span className="flex-1 text-sm font-semibold text-[var(--fs-ink)] transition-colors">
                      {alt}
                    </span>

                    {/* Arrow */}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      aria-hidden="true"
                      strokeWidth="2"
                      className="text-[var(--fs-muted)] group-hover:text-[var(--fs-accent)] transition-colors flex-shrink-0"
                    >
                      <path
                        d="M5 12h14M12 5l7 7-7 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </m.button>
                ))}
              </div>
            ) : (
              <p
                className="text-sm"
                style={{ color: 'var(--fs-muted)', textAlign: 'start', margin: '4px 0 4px' }}
              >
                אין חלופות מוכנות לתרגיל הזה — אפשר לבחור כל תרגיל מהספרייה.
              </p>
            )}

            {/* Choose-from-library entry — opens the full picker (built-ins +
                custom). Distinct accent-outline treatment so it reads as the
                "open more options" action below the preset list. */}
            {onSelectFromLibrary && (
              <button
                type="button"
                onClick={() => setShowLibrary(true)}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fs-surface)] active:scale-[0.99] transition-ui"
                style={{
                  marginTop: 14,
                  padding: '12px 16px',
                  background: 'color-mix(in srgb, var(--fs-accent) 10%, var(--fs-surface))',
                  border: '1px dashed color-mix(in srgb, var(--fs-accent) 45%, var(--fs-steel))',
                  borderRadius: 'var(--radius-asymmetric)',
                  color: 'var(--fs-accent-2)',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <Library size={16} aria-hidden="true" />
                בחר מהספרייה
              </button>
            )}
          </>
        )}
      </Sheet>
    );
  }
);

AlternativesSheet.displayName = 'AlternativesSheet';

export default AlternativesSheet;
