import {
  AnimatePresence,
  animate,
  m,
  useDragControls,
  useMotionValue,
  useReducedMotion,
} from 'framer-motion';
import type React from 'react';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Z_INDEX } from '../../constants/zIndex';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { triggerHapticEffect } from '../../utils/haptics';

type ZLevel = 'default' | 'high' | 'ultra' | 'extreme';
type BlurLevel = 'none' | 'sm' | 'md' | 'xl';
type VariantType = 'modal' | 'bottomSheet' | 'fullscreen' | 'none';

interface ModalOverlayProps {
  isOpen: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  /**
   * Z-index level:
   * - 'default' = modal (1100)
   * - 'high' = modal (1100, compatibility alias)
   * - 'ultra' = modal (1100)
   * - 'extreme' = splash (2000, system-level)
   */
  zLevel?: ZLevel;
  /** Backdrop opacity percentage: 50, 60, 70, 80, 90, 95 */
  backdropOpacity?: 50 | 60 | 70 | 80 | 90 | 95;
  /** Blur intensity */
  blur?: BlurLevel;
  /** Whether to center content (default) or allow custom positioning */
  centered?: boolean;
  /** Additional class names for the overlay container */
  className?: string;
  /** Animation duration in seconds */
  animationDuration?: number;
  /**
   * Variant type:
   * - 'modal' = centered modal (default)
   * - 'bottomSheet' = slides up from bottom with safe area padding
   * - 'fullscreen' = covers entire screen with no padding
   * - 'none' = no animation, just fade
   */
  variant?: VariantType;
  /** Whether to use portal rendering (default: true for proper z-index stacking) */
  usePortal?: boolean;
  /** Whether to trap focus within the modal (default: true) */
  trapFocus?: boolean;
  /** Whether to auto-focus the first focusable element (default: true) */
  autoFocus?: boolean;
  /** Whether to restore focus to the trigger element when closed (default: true) */
  restoreFocus?: boolean;
  /** CSS selector for the element to focus initially */
  initialFocusSelector?: string;
  /** Whether clicking the backdrop closes the modal (default: true) */
  closeOnBackdropClick?: boolean;
  /** Whether pressing Escape closes the modal (default: true) */
  closeOnEscape?: boolean;
  /** Whether to lock body scroll when modal is open (default: true) */
  lockScroll?: boolean;
  /** Accessibility label for the modal */
  ariaLabel?: string;
  /** ID of element that labels the modal (takes precedence over ariaLabel) */
  ariaLabelledBy?: string;
  /** ID of element that describes the modal */
  ariaDescribedBy?: string;
}

const zIndexMap: Record<ZLevel, number> = {
  default: Z_INDEX.modal,
  high: Z_INDEX.modal,
  ultra: Z_INDEX.modal,
  extreme: Z_INDEX.splash,
};

const blurPxMap: Record<BlurLevel, string | undefined> = {
  none: undefined,
  sm: 'blur(8px)',
  md: 'blur(12px)',
  xl: 'blur(24px)',
};

// Apple's exponential-decay momentum projection (Designing Fluid Interfaces):
// where a flick would come to rest, so a throw dismisses even from a small drag.
// Module-scope pure function — stable across renders, no hook dependency needed.
const projectMomentum = (velocity: number): number => {
  const decel = 0.995;
  return ((velocity / 1000) * decel) / (1 - decel);
};

/**
 * Reusable modal overlay component with consistent styling.
 *
 * Uses portal rendering to ensure modals always appear above the navigation bar.
 * Includes focus trapping, scroll locking, and keyboard navigation support.
 *
 * @example
 * ```tsx
 * <ModalOverlay isOpen={isOpen} onClose={() => setIsOpen(false)}>
 *   <div className="bg-surface-glass p-6 rounded-xl">
 *     Modal content here
 *   </div>
 * </ModalOverlay>
 *
 * // Bottom sheet variant
 * <ModalOverlay isOpen={isOpen} onClose={onClose} variant="bottomSheet">
 *   <div className="w-full max-w-md">Bottom sheet content</div>
 * </ModalOverlay>
 *
 * // Fullscreen variant
 * <ModalOverlay isOpen={isOpen} onClose={onClose} variant="fullscreen">
 *   <div className="w-full h-full">Fullscreen content</div>
 * </ModalOverlay>
 * ```
 */
export const ModalOverlay: React.FC<ModalOverlayProps> = ({
  isOpen,
  onClose,
  children,
  zLevel = 'default',
  backdropOpacity = 70,
  blur = 'sm',
  centered = true,
  className = '',
  animationDuration = 0.2,
  variant = 'modal',
  usePortal = true,
  trapFocus = true,
  autoFocus = true,
  restoreFocus = true,
  initialFocusSelector,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  lockScroll = true,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion() ?? false;

  // Premium timing — respect prefers-reduced-motion (durations collapse to 0)
  const backdropDuration = prefersReduced ? 0 : 0.24;
  const contentDuration = prefersReduced ? 0 : 0.42;
  const premiumEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

  // ── Bottom-sheet drag-to-dismiss ─────────────────────────────────────────
  // A grab-and-drag on the sheet handle (any element marked
  // [data-sheet-drag-handle]) tracks the finger 1:1 downward, rubber-bands
  // upward, and on release either projects momentum to dismiss or springs home
  // carrying the release velocity — the native iOS sheet feel. The drag lives on
  // an INNER layer so the outer layer's enter/exit slide stays framer-managed and
  // the two transforms never fight; the scrollable body keeps `pan-y` so content
  // still scrolls (only the handle initiates a drag). Interruptible by design:
  // a new grab re-starts from the live transform. Skill §2/§3/§5/§6/§9/§13.
  const dragControls = useDragControls();
  const sheetY = useMotionValue(0);
  const dismissArmedRef = useRef(false);

  // Reset the drag offset before a fresh open so a prior drag-dismiss doesn't
  // leave the sheet pre-offset on reopen. Layout effect → no painted flash.
  useLayoutEffect(() => {
    if (isOpen) {
      sheetY.set(0);
      dismissArmedRef.current = false;
    }
  }, [isOpen, sheetY]);

  const measureSheetHeight = useCallback((): number => {
    const measured = contentRef.current?.offsetHeight;
    if (measured && measured > 0) return measured;
    return typeof window !== 'undefined' ? window.innerHeight * 0.85 : 600;
  }, []);

  const startSheetDrag = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest('[data-sheet-drag-handle]')) {
        dismissArmedRef.current = false;
        dragControls.start(e);
      }
    },
    [dragControls]
  );

  // One selection tick the moment the drag passes the dismiss threshold — the
  // causal "release now to close" beat, fired on the crossing frame only (§13).
  const handleSheetDrag = useCallback(() => {
    if (!onClose) return;
    const armed = sheetY.get() > measureSheetHeight() * 0.3;
    if (armed !== dismissArmedRef.current) {
      dismissArmedRef.current = armed;
      if (armed) triggerHapticEffect('selection');
    }
  }, [onClose, sheetY, measureSheetHeight]);

  const handleSheetDragEnd = useCallback(
    (_e: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
      const height = measureSheetHeight();
      const projected = info.offset.y + projectMomentum(info.velocity.y);
      if (onClose && (projected > height * 0.42 || info.velocity.y > 850)) {
        // Exit animates the outer layer from its CURRENT presentation value, so
        // the drag flows straight into the dismiss with no jump (§3).
        onClose();
        return;
      }
      // Snap home carrying the release velocity (§5); a whisper of settle because
      // a flick preceded it (§4). Interrupted cleanly by the next grab.
      animate(sheetY, 0, {
        type: 'spring',
        stiffness: 480,
        damping: 40,
        velocity: info.velocity.y,
      });
      dismissArmedRef.current = false;
    },
    [onClose, sheetY, measureSheetHeight]
  );

  // Use focus trap for accessibility - trap focus on the content, not the backdrop
  useFocusTrap(contentRef, {
    isOpen: isOpen && trapFocus,
    onClose: closeOnEscape ? onClose : undefined,
    closeOnEscape,
    closeOnClickOutside: false, // We handle this manually
    lockScroll,
    autoFocus,
    restoreFocus,
    initialFocus: initialFocusSelector,
  });

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget && onClose) {
      onClose();
    }
  };

  const isBottomSheet = variant === 'bottomSheet';
  const isFullscreen = variant === 'fullscreen';
  const isNone = variant === 'none';

  // Bottom sheets enter/exit on a critically-damped spring (calm, no overshoot on
  // a non-gesture open — §4); other variants keep the editorial ease. Reduced
  // motion collapses to an instant cross-fade (§14). The drag adds its own
  // velocity-aware spring on release (see handleSheetDragEnd).
  const contentTransition = isBottomSheet
    ? prefersReduced
      ? { duration: 0 }
      : {
          type: 'spring' as const,
          bounce: 0,
          duration: Math.max(animationDuration, 0.45),
          opacity: { duration: 0.3, ease: premiumEase },
        }
    : { duration: contentDuration, ease: premiumEase };

  // Position classes based on variant
  const positionClasses = isBottomSheet
    ? 'flex items-end justify-center'
    : isFullscreen
      ? 'flex items-center justify-center'
      : centered
        ? 'flex items-center justify-center'
        : '';

  // Animation variants for content
  const contentAnimation = isBottomSheet
    ? {
        initial: { opacity: 0, y: '100%' },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: '100%' },
      }
    : isFullscreen
      ? {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
        }
      : isNone
        ? {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 },
          }
        : {
            initial: { opacity: 0, scale: 0.96, y: 8 },
            animate: { opacity: 1, scale: 1, y: 0 },
            exit: { opacity: 0, scale: 0.96, y: 8 },
          };

  // Modal variant uses the premium glass surface for content
  const useGlassContent = !isBottomSheet && !isFullscreen && !isNone;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <m.div
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: backdropDuration, ease: 'easeOut' }}
          className={`
                        fixed inset-0
                        ${positionClasses}
                        ${isBottomSheet ? 'p-0' : isFullscreen ? 'p-0' : 'p-4'}
                        ${className}
                    `
            .replace(/\s+/g, ' ')
            .trim()}
          style={{
            zIndex: zIndexMap[zLevel],
            // Premium glass backdrop — primary-tinted. Blur honors the `blur`
            // prop (blur="none" => no filter), instead of a hardcoded 8px.
            backgroundColor: `color-mix(in srgb, var(--fs-primary) ${backdropOpacity}%, transparent)`,
            WebkitBackdropFilter: blurPxMap[blur],
            backdropFilter: blurPxMap[blur],
          }}
          onClick={handleBackdropClick}
        >
          <m.div
            ref={contentRef}
            initial={contentAnimation.initial}
            animate={contentAnimation.animate}
            exit={contentAnimation.exit}
            transition={contentTransition}
            className={`${useGlassContent ? 'glass-surface' : ''} ${
              isBottomSheet ? 'w-full max-w-lg' : isFullscreen ? 'w-full h-full' : ''
            }`.trim()}
            style={
              isBottomSheet
                ? {
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                  }
                : undefined
            }
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabelledBy ? undefined : ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-describedby={ariaDescribedBy}
          >
            {isBottomSheet && !prefersReduced ? (
              // Inner drag layer — 1:1 downward, rubber-band up, velocity handoff on
              // release. Keeps `pan-y` so the sheet body still scrolls; only a
              // [data-sheet-drag-handle] pointer-down (handle/title) starts a drag.
              <m.div
                className="w-full"
                style={{ y: sheetY, touchAction: 'pan-y' }}
                drag="y"
                dragControls={dragControls}
                dragListener={false}
                dragConstraints={{ top: 0 }}
                dragElastic={0.08}
                dragMomentum={false}
                onPointerDown={startSheetDrag}
                onDrag={handleSheetDrag}
                onDragEnd={handleSheetDragEnd}
              >
                {children}
              </m.div>
            ) : (
              children
            )}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );

  // Use portal to render at document.body for proper z-index stacking
  if (usePortal && typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};

export default ModalOverlay;
