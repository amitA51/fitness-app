// AlternativesSheet — pick an alternative exercise, built on the foundation
// <Sheet>. Migrated off the bespoke ModalOverlay variant="none" + raw m.div
// sheet: drag handle, header, scroll body, safe-area, focus trap all come from
// Sheet. Behavior unchanged: tapping an alternative fires onSelect then closes.

import { m } from 'framer-motion';
import { memo, useCallback } from 'react';
import { useHapticFeedback } from '../../../hooks/useHapticFeedback';
import { Sheet } from '../../ui/Sheet';

interface AlternativesSheetProps {
  isOpen: boolean;
  alternatives: string[];
  exerciseName: string;
  onSelect?: (altName: string) => void;
  onClose: () => void;
}

const AlternativesSheet = memo<AlternativesSheetProps>(
  ({ isOpen, alternatives, exerciseName, onSelect, onClose }) => {
    const haptics = useHapticFeedback();

    const handleSelect = useCallback(
      (name: string) => {
        haptics.selection();
        onSelect?.(name);
        onClose();
      },
      [onSelect, onClose, haptics]
    );

    return (
      <Sheet
        isOpen={isOpen}
        onClose={onClose}
        title="תרגילים חלופיים"
        ariaLabel={`תרגילים חלופיים ל${exerciseName}`}
      >
        <p
          className="text-xs"
          style={{ color: 'var(--fs-muted)', marginBottom: 12, textAlign: 'start' }}
        >
          במקום {exerciseName}
        </p>

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
                transition-all group
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
              {onSelect && (
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
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </m.button>
          ))}
        </div>
      </Sheet>
    );
  }
);

AlternativesSheet.displayName = 'AlternativesSheet';

export default AlternativesSheet;
