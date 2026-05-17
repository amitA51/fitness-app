// RPEPicker - Fresh Steel Compact Design
// Single button showing current RPE · on tap opens compact popover with 6-10 + tags
// No full-screen modal overlay — small bottom popover

import { AnimatePresence, motion } from 'framer-motion';
import { memo, useCallback, useEffect, useRef, useState } from 'react';

interface RPEPickerProps {
  isOpen: boolean;
  currentValue: number | null | undefined;
  targetRPE?: string;
  onSelect: (rpe: number | null) => void;
  onClose: () => void;
}

const RPE_VALUES = [6, 7, 8, 9, 10];

const RPE_TAGS = [
  { label: 'טכניקה נקייה', value: 'clean' },
  { label: 'כמעט כשל', value: 'near-failure' },
  { label: 'כאב', value: 'pain' },
  { label: 'להוריד עומס', value: 'deload' },
];

const RPE_LABELS: Record<number, string> = {
  6: 'בינוני-קשה',
  7: 'קשה',
  8: 'קשה מאוד',
  9: 'כמעט מקסימלי',
  10: 'מקסימלי!',
};

const RPEPicker = memo<RPEPickerProps>(({ isOpen, currentValue, targetRPE, onSelect, onClose }) => {
  const [selected, setSelected] = useState<number | null>(currentValue ?? null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync selected when currentValue changes
  useEffect(() => {
    setSelected(currentValue ?? null);
  }, [currentValue, isOpen]);

  const handleSelect = useCallback(
    (value: number) => {
      const newValue = selected === value ? null : value;
      setSelected(newValue);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([5]);
      }
      // Auto-select on tap (no confirm button needed)
      onSelect(newValue);
    },
    [selected, onSelect]
  );

  const handleTagSelect = useCallback((tagValue: string) => {
    setSelectedTag((prev) => (prev === tagValue ? null : tagValue));
  }, []);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose]
  );

  const currentLabel = currentValue ? RPE_LABELS[currentValue] : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            backgroundColor: 'rgba(13, 21, 22, 0.5)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={handleBackdropClick}
        >
          <motion.div
            ref={popoverRef}
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 400,
              background: 'var(--fs-surface)',
              borderTopLeftRadius: '24px 16px',
              borderTopRightRadius: '24px 16px',
              border: '1px solid var(--fs-steel)',
              borderBottom: 'none',
              padding: '20px 20px calc(20px + env(safe-area-inset-bottom, 8px))',
              boxShadow: '0 -8px 30px rgba(0,0,0,0.08)',
            }}
          >
            {/* Handle bar */}
            <div
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                background: 'var(--fs-surface-2)',
                margin: '0 auto 16px',
              }}
            />

            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <div>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.22em',
                    color: 'var(--fs-muted)',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                  }}
                >
                  RPE · דירוג מאמץ
                </span>
                {currentLabel && (
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 18,
                      color: 'var(--fs-ink)',
                      marginTop: 4,
                    }}
                  >
                    {currentLabel}
                  </div>
                )}
              </div>
              {targetRPE && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--fs-accent)',
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    padding: '4px 10px',
                    background: 'var(--fs-surface-2)',
                    borderRadius: '12px 8px 12px 8px',
                  }}
                >
                  יעד: RPE {targetRPE}
                </span>
              )}
            </div>

            {/* RPE Numbers */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 8,
                marginBottom: 16,
              }}
            >
              {RPE_VALUES.map((rpe) => {
                const isActive = selected === rpe;
                return (
                  <motion.button
                    key={rpe}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => handleSelect(rpe)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 2,
                      padding: '14px 4px',
                      background: isActive ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
                      border: isActive
                        ? '1.5px solid var(--fs-accent)'
                        : '1.5px solid transparent',
                      borderRadius: '14px 10px 14px 10px',
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontWeight: 900,
                        fontSize: 22,
                        lineHeight: 1,
                        color: isActive ? '#FFFFFF' : 'var(--fs-ink)',
                      }}
                    >
                      {rpe}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 8,
                        color: isActive ? 'rgba(255,255,255,0.85)' : 'var(--fs-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}
                    >
                      {RPE_LABELS[rpe as keyof typeof RPE_LABELS]?.slice(0, 4) ?? ''}
                    </span>
                  </motion.button>
                );
              })}
            </div>

            {/* Tags */}
            <div>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.18em',
                  color: 'var(--fs-muted)',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  display: 'block',
                  marginBottom: 8,
                }}
              >
                תיוג סט
              </span>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                {RPE_TAGS.map((tag) => {
                  const isActive = selectedTag === tag.value;
                  return (
                    <button
                      key={tag.value}
                      type="button"
                      onClick={() => handleTagSelect(tag.value)}
                      style={{
                        padding: '8px 14px',
                        background: isActive ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
                        border: isActive
                          ? '1.5px solid var(--fs-accent)'
                          : '1.5px solid transparent',
                        borderRadius: '14px 10px 14px 10px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 700,
                        color: isActive ? '#FFFFFF' : 'var(--fs-ink)',
                        cursor: 'pointer',
                        transition: 'all 120ms ease',
                      }}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

RPEPicker.displayName = 'RPEPicker';

export default RPEPicker;
