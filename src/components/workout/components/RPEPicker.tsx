// RPEPicker - VISION Sport Annual Editorial Design
// Navy · Mustard · Bone · Big Shoulders Display + IBM Plex Mono

import { AnimatePresence, motion } from 'framer-motion';
import { memo, useCallback, useState } from 'react';
import { ModalOverlay } from '../../ui/ModalOverlay';

interface RPEPickerProps {
  isOpen: boolean;
  currentValue: number | null | undefined;
  targetRPE?: string;
  onSelect: (rpe: number | null) => void;
  onClose: () => void;
}

const RPE_DATA: {
  value: number;
  label: string;
  color: string;
  description: string;
}[] = [
  { value: 1, label: '1', color: '#2D8B4E', description: 'מאמץ מינימלי' },
  { value: 2, label: '2', color: '#2D8B4E', description: 'קל מאוד' },
  { value: 3, label: '3', color: '#2D8B4E', description: 'קל' },
  { value: 4, label: '4', color: '#2D8B4E', description: 'בינוני-קל' },
  { value: 5, label: '5', color: '#E8B82D', description: 'בינוני' },
  { value: 6, label: '6', color: '#E8B82D', description: 'בינוני-קשה' },
  { value: 7, label: '7', color: '#E8B82D', description: 'קשה' },
  { value: 8, label: '8', color: '#E8B82D', description: 'קשה מאוד' },
  { value: 9, label: '9', color: '#C42B2B', description: 'כמעט מקסימלי' },
  { value: 10, label: '10', color: '#C42B2B', description: 'מקסימלי!' },
];

const RPEPicker = memo<RPEPickerProps>(({ isOpen, currentValue, targetRPE, onSelect, onClose }) => {
  const [selected, setSelected] = useState<number | null>(currentValue ?? null);

  const handleSelect = useCallback((value: number) => {
    setSelected((prev) => (prev === value ? null : value));
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([5]);
    }
  }, []);

  const handleConfirm = useCallback(() => {
    onSelect(selected);
    onClose();
  }, [selected, onSelect, onClose]);

  const selectedData = selected ? RPE_DATA.find((r) => r.value === selected) : null;

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      variant="none"
      zLevel="high"
      backdropOpacity={60}
      blur="sm"
      trapFocus
      lockScroll
      closeOnBackdropClick
      closeOnEscape
      ariaLabel="דירוג מאמץ RPE"
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--bone)',
          borderTop: '2px solid var(--navy)',
          paddingBottom: 'env(safe-area-inset-bottom, 16px)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--bone-deep)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.22em',
              color: 'var(--mustard)',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            §01 · דירוג מאמץ
          </div>
          <h3
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: 22,
              color: 'var(--navy)',
              textTransform: 'uppercase',
              letterSpacing: '-0.01em',
            }}
          >
            RPE
          </h3>
          {targetRPE && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 8,
                padding: '4px 12px',
                background: 'var(--mustard)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  color: 'var(--navy)',
                  letterSpacing: '0.1em',
                }}
              >
                יעד:
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 14,
                  color: 'var(--navy)',
                }}
              >
                RPE {targetRPE}
              </span>
            </div>
          )}
        </div>

        {/* RPE Grid */}
        <div style={{ padding: '16px 20px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 8,
            }}
          >
            {RPE_DATA.map((rpe) => {
              const isSelected = selected === rpe.value;
              return (
                <motion.button
                  key={rpe.value}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSelect(rpe.value)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: '16px 8px',
                    background: isSelected ? rpe.color : 'var(--bone-deep)',
                    border: isSelected ? `2px solid ${rpe.color}` : '2px solid var(--navy)',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 900,
                      fontSize: 24,
                      color: isSelected ? 'var(--navy)' : 'var(--stone)',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {rpe.value}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 8,
                      color: isSelected ? 'var(--navy)' : 'var(--stone)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      opacity: isSelected ? 1 : 0.7,
                    }}
                  >
                    {rpe.description.slice(0, 4)}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Selected Description */}
        <AnimatePresence mode="sync">
          {selectedData && (
            <motion.div
              key={selectedData.value}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{
                textAlign: 'center',
                padding: '0 20px 16px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 600,
                  color: selectedData.color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.15em',
                }}
              >
                {selectedData.description}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            padding: '0 20px 24px',
          }}
        >
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '16px 20px',
              background: 'transparent',
              border: '2px solid var(--navy)',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--navy)',
              cursor: 'pointer',
            }}
          >
            ביטול
          </button>
          {selected && (
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => {
                onSelect(null);
                onClose();
              }}
              style={{
                padding: '16px 20px',
                background: 'transparent',
                border: '2px solid #C42B2B',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 14,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#C42B2B',
                cursor: 'pointer',
              }}
            >
              נקה
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleConfirm}
            style={{
              flex: 1,
              padding: '16px 20px',
              background: 'var(--navy)',
              border: 'none',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 14,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: selectedData ? selectedData.color : 'var(--mustard)',
              cursor: 'pointer',
            }}
          >
            אישור
          </motion.button>
        </div>
      </motion.div>
    </ModalOverlay>
  );
});

RPEPicker.displayName = 'RPEPicker';

export default RPEPicker;
