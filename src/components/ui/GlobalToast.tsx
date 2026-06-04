// GlobalToast — Imperative toast notification system
// Features: Auto-dismiss, slide-in animation, variant + position + duration.
// ARIA: role + aria-live per A-10 accessibility requirements.
//
// Canonical toast for the whole app. Replaces ad-hoc toasts (e.g. the workout
// WaterReminderToast) — see showToast() docs for the exact water call.

import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Z_INDEX } from '../../constants/zIndex';

/** Visual intent. `water` is the cyan hydration-reminder style (accent-tinted). */
export type ToastVariant = 'success' | 'error' | 'info' | 'water';

/** Where the toast stack renders. Top = system feedback, bottom = ambient nudges. */
export type ToastPosition = 'top' | 'bottom';

/** Default auto-dismiss windows (ms) per position. Overridable per-toast. */
const DEFAULT_DURATION_MS: Record<ToastPosition, number> = {
  top: 3000,
  bottom: 5000,
};

/** Inline action rendered inside the toast (e.g. "בטל" for undo). */
export interface ToastAction {
  label: string;
  onClick: () => void;
}

/** Options accepted by the imperative {@link showToast} API. */
export interface ToastOptions {
  variant?: ToastVariant;
  /** Top (default) for feedback; bottom for ambient reminders. */
  position?: ToastPosition;
  /** Auto-dismiss in ms. Defaults to 3000 (top) / 5000 (bottom). */
  duration?: number;
  /** Optional secondary line under the title (e.g. "זמן ללגום מים"). */
  description?: string;
  /** Optional action button (e.g. undo). Tapping it dismisses the toast. */
  action?: ToastAction;
}

interface ToastMessage {
  id: number;
  text: string;
  variant: ToastVariant;
  position: ToastPosition;
  duration: number;
  description?: string;
  action?: ToastAction;
}

const VARIANT_STYLES: Record<ToastVariant, { accent: string; eyebrow: string }> = {
  success: { accent: 'var(--fs-accent)', eyebrow: 'SUCCESS' },
  error: { accent: 'var(--color-error)', eyebrow: 'ERROR' },
  // `info` uses --fs-ink (not --fs-primary): in dark mode --fs-primary (#0a0a0a)
  // is near-black on the toast's --fs-bg (#000) surface, so the border + eyebrow
  // would vanish. --fs-ink always contrasts against --fs-bg in both themes.
  info: { accent: 'var(--fs-ink)', eyebrow: 'INFO' },
  // Water — hydration reminder. Accent-tinted fill via the RGB channel token
  // (replaces the old hardcoded cyan in WaterReminderToast).
  water: { accent: 'var(--fs-accent)', eyebrow: 'מים' },
};

let toastId = 0;

// Singleton state — allows imperative usage from anywhere
let globalSetToasts: React.Dispatch<React.SetStateAction<ToastMessage[]>> | null = null;

/**
 * Imperatively show a toast from anywhere (no React context required).
 *
 * Backward-compatible: the legacy `showToast(text, 'success')` signature still
 * works. Pass an options object for variant/position/duration/description.
 *
 * @example
 * // Feedback (top, 3s) — unchanged legacy call sites:
 * showToast('נשמר בהצלחה');
 * showToast('שגיאה בשמירה', 'error');
 *
 * // Water reminder (replaces <WaterReminderToast/>): bottom, 5s, cyan style.
 * showToast('תזכורת מים', { variant: 'water', position: 'bottom', description: 'זמן ללגום מים' });
 */
export function showToast(text: string, optionsOrVariant: ToastOptions | ToastVariant = {}): void {
  if (!globalSetToasts) return;

  const options: ToastOptions =
    typeof optionsOrVariant === 'string' ? { variant: optionsOrVariant } : optionsOrVariant;

  const variant = options.variant ?? 'success';
  const position = options.position ?? 'top';
  const duration = options.duration ?? DEFAULT_DURATION_MS[position];

  const id = ++toastId;
  globalSetToasts((prev) => {
    const next = {
      id,
      text,
      variant,
      position,
      duration,
      description: options.description,
      action: options.action,
    };
    if (prev.length < 3) return [...prev, next];
    // Stack is full — evict the oldest non-error toast first so error
    // feedback is never silently dropped before the user can read it.
    const evictIndex = prev.findIndex((t) => t.variant !== 'error');
    const survivors = evictIndex === -1 ? prev.slice(1) : prev.filter((_, i) => i !== evictIndex);
    return [...survivors, next];
  });
}

const ToastItem = memo<{ toast: ToastMessage; onDismiss: (id: number) => void }>(
  ({ toast, onDismiss }) => {
    const style = VARIANT_STYLES[toast.variant];
    const prefersReduced = useReducedMotion() ?? false;
    const isBottom = toast.position === 'bottom';
    const isWater = toast.variant === 'water';

    useEffect(() => {
      const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
      return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onDismiss]);

    // Enter from the edge the toast is anchored to; collapse motion when reduced.
    const enterY = prefersReduced ? 0 : isBottom ? 24 : -40;
    const exitY = prefersReduced ? 0 : isBottom ? 20 : -20;

    return (
      <m.div
        layout
        initial={{ opacity: 0, y: enterY, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: exitY, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="flex items-start gap-3 px-4 py-3"
        role={toast.variant === 'error' ? 'alert' : 'status'}
        aria-live={toast.variant === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
        style={{
          backgroundColor: isWater ? 'rgba(var(--fs-accent-rgb), 0.16)' : 'var(--fs-bg)',
          border: `1px solid ${style.accent}`,
          borderRadius: isWater ? 'var(--radius-full)' : 0,
          boxShadow: '0 8px 24px rgba(11,26,43,0.12)',
          backdropFilter: isWater ? 'blur(12px)' : undefined,
          WebkitBackdropFilter: isWater ? 'blur(12px)' : undefined,
        }}
      >
        <div className="flex-1 min-w-0">
          <div
            className="uppercase"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              letterSpacing: '0.22em',
              color: style.accent,
              fontWeight: 600,
              marginBottom: 2,
            }}
          >
            {style.eyebrow}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--fs-ink)',
              fontWeight: 600,
            }}
          >
            {toast.text}
          </div>
          {toast.description && (
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '12px',
                color: 'var(--fs-muted)',
                fontWeight: 500,
                marginTop: 2,
              }}
            >
              {toast.description}
            </div>
          )}
        </div>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="transition-colors text-xs font-bold uppercase"
            style={{
              fontFamily: 'var(--font-mono)',
              color: style.accent,
              letterSpacing: '0.08em',
              borderRadius: 0,
              minWidth: 44,
              minHeight: 44,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingInline: 'var(--space-2)',
            }}
          >
            {toast.action.label}
          </button>
        )}
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label="סגירת התראה"
          className="transition-colors text-xs font-bold uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--fs-muted)',
            letterSpacing: '0.08em',
            borderRadius: 0,
            minWidth: 44,
            minHeight: 44,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✕
        </button>
      </m.div>
    );
  }
);

ToastItem.displayName = 'ToastItem';

/** Mount once at the top of your app tree (App.tsx) */
export const ToastContainer = memo(() => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    globalSetToasts = setToasts;
    return () => {
      globalSetToasts = null;
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const topToasts = useMemo(() => toasts.filter((t) => t.position === 'top'), [toasts]);
  const bottomToasts = useMemo(() => toasts.filter((t) => t.position === 'bottom'), [toasts]);

  return (
    <>
      <div
        className="fixed top-4 inset-x-4 flex flex-col items-center gap-2 pointer-events-none"
        style={{ zIndex: Z_INDEX.toast }}
      >
        <AnimatePresence>
          {topToasts.map((t) => (
            <div key={t.id} className="pointer-events-auto w-full max-w-sm">
              <ToastItem toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>
      <div
        className="fixed inset-x-4 flex flex-col items-center gap-2 pointer-events-none"
        style={{
          zIndex: Z_INDEX.toast,
          bottom: 'calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + var(--space-4))',
        }}
      >
        <AnimatePresence>
          {bottomToasts.map((t) => (
            <div key={t.id} className="pointer-events-auto w-full max-w-sm">
              <ToastItem toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
});

ToastContainer.displayName = 'ToastContainer';
