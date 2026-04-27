// NotesBottomSheet - Sport Annual Editorial Design
// Sharp corners · Navy header · Bone body
// VISION: Bold · Editorial · Confident · Narrative · Printed

import { motion } from 'framer-motion';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { ModalOverlay } from '../../ui/ModalOverlay';

interface NotesBottomSheetProps {
  isOpen: boolean;
  currentNotes: string;
  exerciseName: string;
  setIndex: number;
  onSave: (notes: string) => void;
  onClose: () => void;
}

const QUICK_NOTES = [
  'כאב קל',
  'הרגשה מצוינת',
  'משקל קל מדי',
  'משקל כבד מדי',
  'טכניקה לא טובה',
  'Drop Set',
  'פאוז בתחתית',
  'שליטה מלאה',
];

const NotesBottomSheet = memo<NotesBottomSheetProps>(
  ({ isOpen, currentNotes, exerciseName, setIndex, onSave, onClose }) => {
    const [text, setText] = useState(currentNotes);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
      if (isOpen) {
        setText(currentNotes);
        setTimeout(() => textAreaRef.current?.focus(), 200);
      }
    }, [isOpen, currentNotes]);

    const handleSave = useCallback(() => {
      onSave(text.trim());
      onClose();
    }, [text, onClose, onSave]);

    const handleQuickNote = useCallback((note: string) => {
      setText((prev) => {
        const separator = prev.trim() ? ', ' : '';
        return prev + separator + note;
      });
    }, []);

    return (
      <ModalOverlay
        isOpen={isOpen}
        onClose={onClose}
        variant="none"
        zLevel="high"
        backdropOpacity={60}
        blur="none"
        trapFocus
        lockScroll
        closeOnBackdropClick
        closeOnEscape
        ariaLabel={`הערה לסט ${setIndex + 1} - ${exerciseName}`}
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
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '70vh',
          }}
        >
          {/* Drag Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-8 h-1 rounded-full bg-ink/20 mx-auto mb-4" />
          </div>

          {/* Header */}
          <div style={{ padding: '8px 20px 16px', borderBottom: '1px solid var(--bone-deep)' }}>
            <h3
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 20,
                color: 'var(--navy)',
                letterSpacing: '-0.01em',
              }}
            >
              הערה לסט
            </h3>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.12em',
                color: 'var(--stone)',
                textTransform: 'uppercase',
                marginTop: 2,
              }}
            >
              {exerciseName} · סט {setIndex + 1}
            </p>
          </div>

          {/* Quick Notes */}
          <div style={{ padding: '12px 20px 0' }}>
            <div
              style={{
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                paddingBottom: 8,
                direction: 'rtl',
                scrollbarWidth: 'none',
              }}
            >
              {QUICK_NOTES.map((note) => (
                <button
                  key={note}
                  type="button"
                  onClick={() => handleQuickNote(note)}
                  style={{
                    flexShrink: 0,
                    padding: '6px 14px',
                    background: 'var(--bone-deep)',
                    color: 'var(--stone)',
                    border: '2px solid var(--navy)',
                    borderRadius: 0,
                    fontFamily: 'var(--font-display)',
                    fontWeight: 800,
                    fontSize: 12,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'all 150ms',
                  }}
                >
                  {note}
                </button>
              ))}
            </div>
          </div>

          {/* Text Area */}
          <div style={{ padding: '12px 20px' }}>
            <textarea
              ref={textAreaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="כתוב הערה..."
              rows={3}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'var(--color-surface-input)',
                border: '2px solid var(--navy)',
                borderRadius: 0,
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                color: 'var(--ink)',
                outline: 'none',
                resize: 'none',
                direction: 'rtl',
                textAlign: 'right',
                lineHeight: 1.55,
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 4,
                padding: '0 2px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.12em',
                  color: 'var(--stone)',
                  textTransform: 'uppercase',
                }}
              >
                {text.length} תווים
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  letterSpacing: '0.12em',
                  color: 'var(--stone)',
                  textTransform: 'uppercase',
                }}
              >
                Enter לשמירה
              </span>
            </div>
          </div>

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: '8px 20px 20px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '14px 16px',
                background: 'var(--bone-deep)',
                border: '2px solid var(--navy)',
                borderRadius: 0,
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--navy)',
              }}
            >
              ביטול
            </button>
            {text.trim() && (
              <button
                type="button"
                onClick={() => {
                  onSave('');
                  onClose();
                }}
                style={{
                  padding: '14px 16px',
                  background: 'rgba(196,43,43,0.1)',
                  border: '2px solid var(--color-error)',
                  borderRadius: 0,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 13,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--color-error)',
                }}
              >
                נקה
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              style={{
                flex: 1,
                padding: '14px 16px',
                background: 'var(--navy)',
                border: '2px solid var(--navy)',
                borderRadius: 0,
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 13,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--mustard)',
              }}
            >
              שמור
            </button>
          </div>

          <div style={{ height: 'env(safe-area-inset-bottom, 8px)' }} />
        </motion.div>
      </ModalOverlay>
    );
  }
);

NotesBottomSheet.displayName = 'NotesBottomSheet';

export default NotesBottomSheet;
