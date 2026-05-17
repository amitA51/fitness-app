// Toast — Inline notification replacing native alert()
// Features: Auto-dismiss, slide-in animation, success/error/info variants
// Sport Annual restyle: sharp-cornered bone cards + mustard/navy/error left-border

import { AnimatePresence, motion } from 'framer-motion';
import { memo, useCallback, useEffect, useState } from 'react';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastMessage {
  id: number;
  text: string;
  variant: ToastVariant;
}

const VARIANT_STYLES: Record<ToastVariant, { accent: string; eyebrow: string }> = {
  success: { accent: 'var(--fs-accent)', eyebrow: 'SUCCESS' },
  error: { accent: 'var(--color-error)', eyebrow: 'ERROR' },
  info: { accent: 'var(--fs-primary)', eyebrow: 'INFO' },
};

let toastId = 0;

// Singleton state — allows imperative usage from anywhere
let globalSetToasts: React.Dispatch<React.SetStateAction<ToastMessage[]>> | null = null;

export function showToast(text: string, variant: ToastVariant = 'success') {
  if (!globalSetToasts) return;
  const id = ++toastId;
  globalSetToasts((prev) => [...prev.slice(-2), { id, text, variant }]);
}

const ToastItem = memo<{ toast: ToastMessage; onDismiss: (id: number) => void }>(
  ({ toast, onDismiss }) => {
    const style = VARIANT_STYLES[toast.variant];

    useEffect(() => {
      const timer = setTimeout(() => onDismiss(toast.id), 3000);
      return () => clearTimeout(timer);
    }, [toast.id, onDismiss]);

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: -40, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="flex items-start gap-3 px-4 py-3"
        style={{
          backgroundColor: 'var(--fs-bg)',
          border: '1px solid var(--fs-surface-2)',
          borderLeft: `3px solid ${style.accent}`,
          borderRadius: 0,
          boxShadow: '0 8px 24px rgba(11,26,43,0.12)',
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
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="transition-colors text-xs font-bold uppercase"
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--fs-muted)',
            letterSpacing: '0.08em',
            borderRadius: 0,
          }}
        >
          ✕
        </button>
      </motion.div>
    );
  }
);

ToastItem.displayName = 'ToastItem';

/** Mount once at the top of your workout tree */
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

  return (
    <div className="fixed top-4 inset-x-4 z-[15000] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto w-full max-w-sm">
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
});

ToastContainer.displayName = 'ToastContainer';
