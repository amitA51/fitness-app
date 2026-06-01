// NotesBottomSheet — set-level notes editor, built on the foundation <Sheet>.
// Migrated off the bespoke ModalOverlay variant="none" + raw motion.div sheet:
// drag handle, header (title + 44px close), scroll body, and sticky footer now
// come from Sheet (RTL-correct, focus-trapped, reduced-motion aware). Behavior
// is unchanged: quick-note chips append text, Enter saves, clear wipes notes.

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../../ui/Button';
import { Sheet } from '../../ui/Sheet';
import { Textarea } from '../../ui/Textarea';

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
        const t = setTimeout(() => textAreaRef.current?.focus(), 200);
        return () => clearTimeout(t);
      }
      return undefined;
    }, [isOpen, currentNotes]);

    const handleSave = useCallback(() => {
      onSave(text.trim());
      onClose();
    }, [text, onClose, onSave]);

    const handleClear = useCallback(() => {
      onSave('');
      onClose();
    }, [onClose, onSave]);

    const handleQuickNote = useCallback((note: string) => {
      setText((prev) => {
        const separator = prev.trim() ? ', ' : '';
        return prev + separator + note;
      });
    }, []);

    const footer = (
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>
          ביטול
        </Button>
        {text.trim() && (
          <Button variant="danger" onClick={handleClear}>
            נקה
          </Button>
        )}
        <Button variant="primary" onClick={handleSave} style={{ flex: 1 }}>
          שמור
        </Button>
      </div>
    );

    return (
      <Sheet
        isOpen={isOpen}
        onClose={onClose}
        title="הערה לסט"
        ariaLabel={`הערה לסט ${setIndex + 1} - ${exerciseName}`}
        footer={footer}
      >
        {/* Context line — exercise · set */}
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.12em',
            color: 'var(--fs-muted)',
            textTransform: 'uppercase',
            marginBottom: 12,
            textAlign: 'start',
          }}
        >
          {exerciseName} · סט {setIndex + 1}
        </p>

        {/* Quick Notes */}
        <div
          style={{
            display: 'flex',
            gap: 6,
            overflowX: 'auto',
            paddingBottom: 8,
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
                minHeight: 44,
                padding: '6px 14px',
                background: 'var(--fs-surface-2)',
                color: 'var(--fs-muted)',
                border: '1px solid var(--fs-steel)',
                borderRadius: 'var(--radius-asymmetric)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.04em',
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
            >
              {note}
            </button>
          ))}
        </div>

        {/* Text Area */}
        <div style={{ marginTop: 12 }}>
          <Textarea
            ref={textAreaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="כתוב הערה..."
            rows={3}
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
                color: 'var(--fs-muted)',
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
                color: 'var(--fs-muted)',
                textTransform: 'uppercase',
              }}
            >
              Enter לשמירה
            </span>
          </div>
        </div>
      </Sheet>
    );
  }
);

NotesBottomSheet.displayName = 'NotesBottomSheet';

export default NotesBottomSheet;
