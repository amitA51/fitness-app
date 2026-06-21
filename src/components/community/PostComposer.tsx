// ============================================================================
// PostComposer — creates a new community post.
// Fresh Steel / Obsidian design system. RTL Hebrew-first.
// ============================================================================

import { Send } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { Card } from '../ui/Card';

const MAX_CHARS = 4000;

/** Outcome the composer reacts to. A rate-limit keeps the draft (the parent
 *  surfaces a toast); a generic failure shows the inline error below. */
export interface PostSubmitResult {
  ok: boolean;
  rateLimited?: boolean;
}

interface PostComposerProps {
  onSubmit: (body: string) => Promise<PostSubmitResult>;
  disabled?: boolean;
}

export function PostComposer({ onSubmit, disabled = false }: PostComposerProps) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charsLeft = MAX_CHARS - body.length;
  const canSubmit = body.trim().length > 0 && body.length <= MAX_CHARS && !submitting && !disabled;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await onSubmit(body.trim());
      if (result.ok) {
        setBody('');
        textareaRef.current?.focus();
      } else if (!result.rateLimited) {
        // Rate-limit is shown as a toast by the parent; keep the draft and stay
        // quiet inline. Any other failure gets the inline error.
        setError('שגיאה בשליחת הפוסט. נסו שוב.');
      }
    } catch {
      setError('שגיאה בשליחת הפוסט. נסו שוב.');
    } finally {
      setSubmitting(false);
    }
  }, [body, canSubmit, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <Card
      asymmetric
      dir="rtl"
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Label always above textarea */}
      <label
        htmlFor="community-post-body"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--fs-ink)',
          lineHeight: 1.3,
        }}
      >
        שתפו עם הקהילה
      </label>

      <textarea
        id="community-post-body"
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        maxLength={MAX_CHARS}
        placeholder="מה חדש?"
        disabled={submitting || disabled}
        aria-describedby="community-post-chars community-post-error"
        style={{
          width: '100%',
          resize: 'vertical',
          background: 'var(--fs-bg)',
          border: '1px solid var(--fs-surface-2)',
          borderRadius: 10,
          padding: '10px 12px',
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          color: 'var(--fs-ink)',
          lineHeight: 1.5,
          outline: 'none',
          transition: 'border-color 0.15s',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--fs-accent)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--fs-surface-2)';
        }}
      />

      {/* Inline error — below input, never toast */}
      {error && (
        <p
          id="community-post-error"
          role="alert"
          style={{
            margin: 0,
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: 'var(--fs-warn)',
          }}
        >
          {error}
        </p>
      )}

      {/* Footer row: char counter + submit button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span
          id="community-post-chars"
          dir="ltr"
          aria-live="polite"
          aria-label={`${charsLeft} תווים נותרו`}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: charsLeft < 100 ? 'var(--fs-warn)' : 'var(--fs-muted)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {charsLeft}
        </span>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-label="שלח פוסט"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            background: canSubmit ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
            color: canSubmit ? 'var(--color-ink-on-accent)' : 'var(--fs-muted)',
            border: 'none',
            borderRadius: 10,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 700,
            transition: 'background 0.15s, transform 0.1s',
            minHeight: 44,
          }}
          onMouseDown={(e) => {
            if (canSubmit) e.currentTarget.style.transform = 'scale(0.98)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          {submitting ? (
            <span aria-hidden="true" style={{ opacity: 0.7 }}>
              שולח…
            </span>
          ) : (
            <>
              <Send size={15} aria-hidden="true" />
              <span>שלח</span>
            </>
          )}
        </button>
      </div>
    </Card>
  );
}
