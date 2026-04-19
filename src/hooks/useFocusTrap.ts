// ============================================================================
// SPARKOS FITNESS - useFocusTrap Hook
// ============================================================================

import { useEffect, useRef } from 'react';

export interface FocusTrapOptions {
  isOpen?: boolean;
  onClose?: () => void;
  closeOnEscape?: boolean;
  closeOnClickOutside?: boolean;
  lockScroll?: boolean;
  autoFocus?: boolean;
  restoreFocus?: boolean;
  initialFocus?: string;
}

// Overload: called with (ref, options) or just (isActive: boolean)
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  options?: FocusTrapOptions
): void;
export function useFocusTrap(isActive?: boolean): { containerRef: React.RefObject<HTMLDivElement> };
export function useFocusTrap(
  refOrActive?: React.RefObject<HTMLElement | null> | boolean,
  options?: FocusTrapOptions
): void | { containerRef: React.RefObject<HTMLDivElement> } {
  // Legacy mode: called with just a boolean
  if (typeof refOrActive === 'boolean' || refOrActive === undefined) {
    const isActive = refOrActive ?? true;
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!isActive || !containerRef.current) return;

      const container = containerRef.current;
      const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };

      container.addEventListener('keydown', handleKeyDown);

      // Auto-focus first element
      if (focusableElements.length > 0) {
        firstElement?.focus();
      }

      return () => {
        container.removeEventListener('keydown', handleKeyDown);
      };
    }, [isActive]);

    return { containerRef };
  }

  // New mode: called with (ref, options)
  const containerRef = refOrActive;
  const {
    isOpen = true,
    onClose,
    closeOnEscape = true,
    closeOnClickOutside = false,
    lockScroll = true,
    autoFocus = true,
    restoreFocus = true,
  } = options || {};

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const container = containerRef.current;

    // Lock scroll
    if (lockScroll) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      // Return cleanup for scroll
      const restoreScroll = () => {
        document.body.style.overflow = originalOverflow;
      };
      // We'll call this in the cleanup
      var _restoreScroll = restoreScroll;
    }

    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const previouslyFocusedElement = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape && onClose) {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // Auto-focus first element
    if (autoFocus && focusableElements.length > 0) {
      setTimeout(() => firstElement?.focus(), 50);
    }

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      if (typeof _restoreScroll === 'function') {
        _restoreScroll();
      }
      if (restoreFocus && previouslyFocusedElement) {
        previouslyFocusedElement.focus?.();
      }
    };
  }, [
    isOpen,
    containerRef,
    closeOnEscape,
    closeOnClickOutside,
    lockScroll,
    autoFocus,
    restoreFocus,
    onClose,
  ]);
}
