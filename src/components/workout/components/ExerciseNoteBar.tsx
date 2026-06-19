// ExerciseNoteBar — pinned note + AI strip at the TOP of the active-workout
// surface (directly under the exercise card). Collapsed it shows a one-line
// preview of the current set's note (or an "add note" affordance); tapping the
// row expands the full note inline. The AI button sits right beside the note so
// "ask the coach" and "jot a note" live together, as requested.

import { ChevronDown, FileText, Pencil, Sparkles } from 'lucide-react';
import { memo, useState } from 'react';
import { triggerHaptic } from '../../../utils/haptics';

interface ExerciseNoteBarProps {
  /** Current set's note text (empty string when none). */
  note: string;
  /** Open the note editor (NotesBottomSheet). */
  onEdit: () => void;
  /** Open the AI coach / exercise guide for this exercise. */
  onOpenAI?: () => void;
}

const ExerciseNoteBar = memo<ExerciseNoteBarProps>(({ note, onEdit, onOpenAI }) => {
  const hasNote = note.trim().length > 0;
  const [expanded, setExpanded] = useState(false);

  const aiButton = onOpenAI ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        triggerHaptic('light');
        onOpenAI();
      }}
      aria-label="שאל את מאמן ה‑AI"
      className="active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-1"
      style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        minHeight: 36,
        padding: '0 12px',
        borderRadius: '10px 7px 10px 7px',
        background: 'linear-gradient(120deg, var(--fs-accent), var(--fs-accent-2))',
        border: 'none',
        color: 'var(--color-ink-on-accent)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.04em',
        cursor: 'pointer',
      }}
    >
      <Sparkles size={14} strokeWidth={2.5} />
      AI
    </button>
  ) : null;

  return (
    <div style={{ padding: '8px 14px 0', flexShrink: 0, background: 'var(--fs-bg)' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          background: 'var(--fs-surface)',
          border: '1px solid var(--fs-steel)',
          borderInlineStart: hasNote
            ? '3px solid var(--fs-accent)'
            : '3px solid var(--fs-surface-2)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {/* Header row — preview + actions. The note text area is a button that
            toggles expand (when a note exists) or opens the editor (when empty). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px' }}>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              if (hasNote) setExpanded((p) => !p);
              else onEdit();
            }}
            aria-expanded={hasNote ? expanded : undefined}
            aria-label={hasNote ? 'הצג/הסתר פתק' : 'הוסף פתק'}
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'transparent',
              border: 'none',
              padding: '4px 2px',
              cursor: 'pointer',
              textAlign: 'start',
              color: 'inherit',
              font: 'inherit',
            }}
          >
            <FileText
              size={15}
              strokeWidth={2.25}
              aria-hidden
              style={{ flexShrink: 0, color: hasNote ? 'var(--fs-accent-2)' : 'var(--fs-muted)' }}
            />
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                fontWeight: hasNote ? 600 : 500,
                color: hasNote ? 'var(--fs-ink)' : 'var(--fs-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {hasNote ? note : 'הוסף פתק לסט…'}
            </span>
            {hasNote && (
              <ChevronDown
                size={16}
                strokeWidth={2.25}
                aria-hidden
                style={{
                  flexShrink: 0,
                  color: 'var(--fs-muted)',
                  transform: expanded ? 'rotate(180deg)' : 'none',
                  transition: 'transform 150ms ease',
                }}
              />
            )}
          </button>

          {/* Edit pencil — only meaningful once a note exists (empty state's row
              already opens the editor). */}
          {hasNote && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic('light');
                onEdit();
              }}
              aria-label="ערוך פתק"
              className="active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-1"
              style={{
                flexShrink: 0,
                width: 36,
                minHeight: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 9,
                background: 'var(--fs-surface-2)',
                border: '1px solid var(--fs-steel)',
                color: 'var(--fs-ink)',
                cursor: 'pointer',
              }}
            >
              <Pencil size={14} strokeWidth={2.25} />
            </button>
          )}

          {aiButton}
        </div>

        {/* Expanded full note */}
        {hasNote && expanded && (
          <div
            style={{
              padding: '0 14px 10px 14px',
              borderTop: '1px solid var(--fs-surface-2)',
            }}
          >
            <p
              style={{
                margin: '8px 0 0',
                fontFamily: 'var(--font-body)',
                fontSize: 14,
                lineHeight: 1.55,
                color: 'var(--fs-ink)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {note}
            </p>
          </div>
        )}
      </div>
    </div>
  );
});

ExerciseNoteBar.displayName = 'ExerciseNoteBar';

export default ExerciseNoteBar;
