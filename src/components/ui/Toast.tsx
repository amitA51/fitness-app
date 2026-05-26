import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Info, X, XCircle } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';

// ============================================================================
// Types  (kept identical to original public interface)
// ============================================================================

export type StatusMessageType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  type?: StatusMessageType;
  message: string;
  description?: string;
  isVisible?: boolean;
  onUndo?: () => void;
  onDismiss: () => void;
  duration?: number;
}

// ============================================================================
// Per-type editorial config — left-border accents + eyebrow labels
// ============================================================================

interface ToastTypeConfig {
  Icon: React.ElementType;
  accent: string; // CSS color for left border + eyebrow
  eyebrow: string; // Text label in the eyebrow
}

const TYPE_CONFIG: Record<StatusMessageType, ToastTypeConfig> = {
  success: {
    Icon: CheckCircle,
    accent: 'var(--fs-accent)',
    eyebrow: 'SUCCESS',
  },
  error: {
    Icon: XCircle,
    accent: 'var(--fs-warn)',
    eyebrow: 'ERROR',
  },
  info: {
    Icon: Info,
    accent: 'var(--fs-accent)',
    eyebrow: 'INFO',
  },
  warning: {
    Icon: AlertTriangle,
    accent: 'var(--fs-warn)',
    eyebrow: 'WARNING',
  },
};

// ============================================================================
// Toast component
// ============================================================================

export const Toast: React.FC<ToastProps> = ({
  type = 'info',
  message,
  description,
  isVisible = true,
  onUndo,
  onDismiss,
  duration = 3000,
}) => {
  // We manage a local "mounted" state so we can play the exit animation before
  // unmounting — the parent only controls `isVisible`.
  const [isMounted, setIsMounted] = useState<boolean>(isVisible);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Kick off auto-dismiss whenever the toast becomes visible
  useEffect(() => {
    if (!isVisible) {
      // Parent wants to hide — trigger exit (AnimatePresence will animate out)
      setIsMounted(false);
      return;
    }

    setIsMounted(true);

    // Auto-dismiss
    dismissTimer.current = setTimeout(() => {
      triggerExit();
    }, duration);

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, duration]);

  function triggerExit() {
    setIsMounted(false);
  }

  function handleExitComplete() {
    if (!isMounted) {
      onDismiss();
    }
  }

  const { Icon, accent, eyebrow } = TYPE_CONFIG[type];

  // Map toast type to breathing-dot variant
  const dotVariantClass =
    type === 'success'
      ? 'breathing-dot'
      : type === 'error' || type === 'warning'
        ? 'breathing-dot warn'
        : 'breathing-dot signal';

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {isMounted && (
        <motion.div
          className="fixed bottom-24 left-1/2 z-[200] w-full max-w-[min(92vw,420px)]"
          role="alert"
          aria-live="polite"
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.96 }}
          transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
          style={{ x: '-50%' }}
        >
          {/* Glass surface card with deep shadow + accent left border */}
          <div
            className="glass-surface relative overflow-hidden"
            style={{
              borderLeft: `3px solid ${accent}`,
              borderRadius: 0,
              boxShadow: 'var(--shadow-deep)',
            }}
          >
            {/* Tinted progress bar along bottom edge */}
            <div
              className="absolute bottom-0 left-0 right-0 h-[2px]"
              style={{ backgroundColor: 'var(--fs-surface-2)' }}
            >
              <div
                className="h-full toast-progress"
                style={{
                  animationDuration: `${duration}ms`,
                  backgroundColor: accent,
                  opacity: 0.7,
                }}
              />
            </div>

            {/* Content row */}
            <div className="flex items-start gap-3 p-4">
              {/* Type icon */}
              <span className="shrink-0 mt-[1px]" style={{ color: accent }}>
                <Icon size={20} strokeWidth={2} />
              </span>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p
                  className="uppercase"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.22em',
                    color: accent,
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  {eyebrow}
                </p>
                <p
                  className="leading-snug inline-flex items-center gap-2"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: '14px',
                    color: 'var(--fs-ink)',
                    fontWeight: 600,
                  }}
                >
                  <span className={dotVariantClass} aria-hidden="true" />
                  {message}
                </p>
                {description && (
                  <p
                    className="mt-0.5 leading-relaxed"
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: '12px',
                      color: 'var(--fs-muted)',
                    }}
                  >
                    {description}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0 ml-1">
                {onUndo && (
                  <button
                    onClick={() => {
                      onUndo();
                      triggerExit();
                    }}
                    className="px-2 py-1 transition-colors duration-150 uppercase"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: '12px',
                      letterSpacing: '0.08em',
                      color: 'var(--fs-heading)',
                      fontWeight: 800,
                      borderRadius: 0,
                    }}
                  >
                    ביטול
                  </button>
                )}

                <button
                  onClick={triggerExit}
                  aria-label="סגור הודעה"
                  className="flex items-center justify-center transition-colors duration-150"
                  style={{
                    minWidth: 44,
                    minHeight: 44,
                    color: 'var(--fs-muted)',
                    borderRadius: 0,
                    background: 'transparent',
                  }}
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Toast;
