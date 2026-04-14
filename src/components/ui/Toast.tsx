import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

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
// Per-type visual config
// ============================================================================

interface ToastTypeConfig {
  Icon: React.ElementType;
  iconClass: string;
  progressClass: string;
  glowClass: string;
}

const TYPE_CONFIG: Record<StatusMessageType, ToastTypeConfig> = {
  success: {
    Icon: CheckCircle,
    iconClass: 'text-emerald-400',
    progressClass: 'bg-emerald-400',
    glowClass: 'shadow-[0_8px_32px_rgba(52,211,153,0.12)]',
  },
  error: {
    Icon: XCircle,
    iconClass: 'text-red-400',
    progressClass: 'bg-red-400',
    glowClass: 'shadow-[0_8px_32px_rgba(248,113,113,0.12)]',
  },
  info: {
    Icon: Info,
    iconClass: 'text-blue-400',
    progressClass: 'bg-blue-400',
    glowClass: 'shadow-[0_8px_32px_rgba(96,165,250,0.12)]',
  },
  warning: {
    Icon: AlertTriangle,
    iconClass: 'text-amber-400',
    progressClass: 'bg-amber-400',
    glowClass: 'shadow-[0_8px_32px_rgba(251,191,36,0.12)]',
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
  const dismissTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const { Icon, iconClass, progressClass, glowClass } = TYPE_CONFIG[type];

  // CSS animation class based on phase
  const animClass =
    phase === 'enter'
      ? 'toast-enter'
      : phase === 'exit'
      ? 'toast-exit'
      : '';

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
      {/* Glass card */}
      <div
        className={`
          relative overflow-hidden rounded-2xl
          bg-[#1C1C1E] backdrop-blur-2xl
          border border-white/[0.08]
          ${glowClass}
        `}
      >
        {/* Tinted progress bar along bottom edge */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.04]">
          <div
            className={`h-full ${progressClass} toast-progress opacity-70`}
            style={{ animationDuration: `${duration}ms` }}
          />
        </div>

        {/* Content row */}
        <div className="flex items-start gap-3 p-4">
          {/* Type icon */}
          <span className={`shrink-0 mt-[1px] ${iconClass}`}>
            <Icon size={20} strokeWidth={2} />
          </span>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-white/95 leading-snug">
              {message}
            </p>
            {description && (
              <p className="text-[12px] text-white/55 mt-0.5 leading-relaxed">
                {description}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0 ml-1">
            {onUndo && (
              <button
                onClick={() => { onUndo(); triggerExit(); }}
                className="
                  text-[12px] font-semibold text-primary
                  px-2 py-1 rounded-lg
                  hover:bg-primary/[0.1]
                  transition-colors duration-150
                "
              >
                ביטול
              </button>
            )}

            <button
              onClick={triggerExit}
              aria-label="סגור הודעה"
              className="
                flex items-center justify-center
                w-6 h-6 rounded-full
                text-white/30 hover:text-white/70
                hover:bg-white/[0.08]
                transition-all duration-150
              "
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
