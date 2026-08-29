import { AnimatePresence, animate, m, useDragControls, useMotionValue } from 'framer-motion';
import type React from 'react';
import { useCallback, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Z_INDEX } from '../../constants/zIndex';
import { useFocusTrap } from '../../hooks/useFocusTrap';
// The app-wide signal, not Framer's: it ORs the OS `prefers-reduced-motion`
// query with the in-app "הפחתת אנימציות" toggle (reflected as
// <html class="reduce-motion">). Framer's own hook reads only the OS query, so
// sheets kept sliding for users who had switched the in-app toggle on.
import { useReducedMotion } from '../../hooks/useReducedMotion';
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
  // Modal content sits above persistent chrome. Cap even the legacy "xl" label
  // at the non-navigation material budget to avoid layered backdrop sampling.
  xl: 'blur(12px)',
};

// Apple's exponential-decay momentum projection (Designing Fluid Interfaces):
// where a flick would come to rest, so a throw dismisses even from a small drag.
// Module-scope pure function — stable across renders, no hook dependency needed.
//
// `decel = 0.998` is Apple's shipped deceleration rate and resolves the formula
// to EXACTLY `velocity_px_per_second * 0.499`:
//   (v / 1000) * 0.998 / (1 - 0.998) = (v / 1000) * 499 = v * 0.499
// It was 0.995 (a 0.199 factor), which under-credited every flick by 2.5x. Note
// the shape of the formula: the `/ 1000` is cancelled by `d/(1-d)`, so a bare
// `(v / 1000) * 0.499` would project a 2500 px/s flick to 1.2px — a no-op.
export const projectMomentum = (velocity: number): number => {
  const decel = 0.998;
  return ((velocity / 1000) * decel) / (1 - decel);
};

// Anything a pointer-down should be read as a TAP rather than the start of a
// sheet drag. Used to protect controls that live inside handle chrome.
const INTERACTIVE_SELECTOR =
  'button, a[href], input, select, textarea, label, [role="button"], [role="switch"], [role="tab"], [contenteditable="true"]';

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
  const prefersReduced = useReducedMotion();

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

  // A pointer-down on a CONTROL is a tap, never a grab — even when that control
  // sits inside handle chrome (a header row marked as a handle still holds its
  // close button). Starting a drag here hands the pointer to Framer, which then
  // swallows the ensuing click: the button goes dead and the sheet reads as
  // stuck open. Marking a whole header as draggable is only safe with this guard.
  const startSheetDrag = useCallback(
    (e: React.PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(INTERACTIVE_SELECTOR)) return;
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
      dismissArmedRef.current = false;
      // Reduced motion keeps the GESTURE — direct manipulation tracks the finger
      // and is not vestibular motion — but no spring may run: write the final
      // value synchronously so the sheet is simply back home on the next frame.
      if (prefersReduced) {
        sheetY.set(0);
        return;
      }
      // Snap home carrying the release velocity (§5); a whisper of settle because
      // a flick preceded it (§4). Interrupted cleanly by the next grab.
      animate(sheetY, 0, {
        type: 'spring',
        bounce: 0,
        duration: 0.4,
        velocity: info.velocity.y,
      });
    },
    [onClose, sheetY, measureSheetHeight, prefersReduced]
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
      ? // §12 materialize-not-fade: a full-screen surface arrives as a sheet of
        // glass settling onto the screen (scale 1.02→1), not a bare fade.
        // Reduced motion keeps the plain cross-fade (§14).
        prefersReduced
        ? {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 },
          }
        : {
            initial: { opacity: 0, scale: 1.02 },
            animate: { opacity: 1, scale: 1 },
            exit: { opacity: 0, scale: 1.01 },
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
            // Centered modals can retain the capped material blur. Bottom sheets
            // deliberately use a dim scrim only: their persistent nav is already
            // the material plane, and stacking filters multiplies rasterization.
            backgroundColor: `color-mix(in srgb, var(--fs-primary) ${backdropOpacity}%, transparent)`,
            WebkitBackdropFilter: isBottomSheet ? undefined : blurPxMap[blur],
            backdropFilter: isBottomSheet ? undefined : blurPxMap[blur],
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
            {isBottomSheet ? (
              // Inner drag layer — 1:1 downward, rubber-band up, velocity handoff on
              // release. Keeps `pan-y` so the sheet body still scrolls; only a
              // [data-sheet-drag-handle] pointer-down (handle/title) starts a drag.
              // Rendered under reduced motion as well: dragging is direct
              // manipulation, and removing it would take a dismissal route away
              // from exactly the users least able to chase a small close button.
              // The release path skips the spring instead (see handleSheetDragEnd).
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
