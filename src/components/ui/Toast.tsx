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
    accent: 'var(--mustard)',
    eyebrow: 'SUCCESS',
  },
  error: {
    Icon: XCircle,
    accent: 'var(--color-error)',
    eyebrow: 'ERROR',
  },
  info: {
    Icon: Info,
    accent: 'var(--navy)',
    eyebrow: 'INFO',
  },
  warning: {
    Icon: AlertTriangle,
    accent: 'var(--color-warning)',
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
  const [phase, setPhase] = useState<'enter' | 'idle' | 'exit'>('enter');
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Kick off auto-dismiss whenever the toast becomes visible
  useEffect(() => {
    if (!isVisible) {
      // Parent wants to hide — trigger exit
      triggerExit();
      return;
    }

    // Fresh appearance
    setPhase('enter');
    // After enter animation (~380 ms), settle into idle
    animTimer.current = setTimeout(() => setPhase('idle'), 400);

    // Auto-dismiss
    dismissTimer.current = setTimeout(() => {
      triggerExit();
    }, duration);

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      if (animTimer.current) clearTimeout(animTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, duration]);

  function triggerExit() {
    setPhase('exit');
    // Wait for exit animation (~280 ms) then call parent's dismiss
    animTimer.current = setTimeout(onDismiss, 300);
  }

  if (!isVisible && phase !== 'exit') return null;

  const { Icon, accent, eyebrow } = TYPE_CONFIG[type];

  // CSS animation class based on phase
  const animClass = phase === 'enter' ? 'toast-enter' : phase === 'exit' ? 'toast-exit' : '';

  return (
    // Portal-style: fixed, slides from top, centered
    <div
      className={`
        fixed top-4 left-1/2 z-[200]
        w-full max-w-[min(92vw,420px)]
        ${animClass}
      `}
      role="alert"
      aria-live="polite"
    >
      {/* Editorial card — sharp corners, bone bg, 2px accent left border */}
      <div
        className="relative overflow-hidden"
        style={{
          backgroundColor: 'var(--bone)',
          border: '1px solid var(--bone-deep)',
          borderLeft: `3px solid ${accent}`,
          borderRadius: 0,
          boxShadow: '0 8px 24px rgba(11,26,43,0.12)',
        }}
      >
        {/* Tinted progress bar along bottom edge */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ backgroundColor: 'var(--bone-deep)' }}>
          <div
            className="h-full toast-progress"
            style={{ animationDuration: `${duration}ms`, backgroundColor: accent, opacity: 0.7 }}
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
              className="leading-snug"
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '14px',
                color: 'var(--ink)',
                fontWeight: 600,
              }}
            >
              {message}
            </p>
            {description && (
              <p
                className="mt-0.5 leading-relaxed"
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  color: 'var(--stone)',
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
                  color: 'var(--navy)',
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
              className="flex items-center justify-center w-6 h-6 transition-colors duration-150"
              style={{
                color: 'var(--stone)',
                borderRadius: 0,
              }}
            >
              <X size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toast;
