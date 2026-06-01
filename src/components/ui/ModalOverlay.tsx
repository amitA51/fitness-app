import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import type React from 'react';
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { Z_INDEX } from '../../constants/zIndex';
import { useFocusTrap } from '../../hooks/useFocusTrap';

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
  ariaDescribedBy,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion() ?? false;

  // Premium timing — respect prefers-reduced-motion (durations collapse to 0)
  const backdropDuration = prefersReduced ? 0 : 0.24;
  const contentDuration = prefersReduced ? 0 : 0.42;
  const premiumEase: [number, number, number, number] = [0.16, 1, 0.3, 1];

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
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy}
        >
          <m.div
            ref={contentRef}
            initial={contentAnimation.initial}
            animate={contentAnimation.animate}
            exit={contentAnimation.exit}
            transition={{
              duration: isBottomSheet ? animationDuration : contentDuration,
              ease: isBottomSheet ? [0.32, 0.72, 0, 1] : premiumEase,
            }}
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
          >
            {children}
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
