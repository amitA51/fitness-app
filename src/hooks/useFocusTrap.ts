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

      const getFocusable = () =>
        Array.from(
          container.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        );

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;
        if (!container.contains(document.activeElement)) return;

        const focusable = getFocusable();
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first || !container.contains(document.activeElement)) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);

      // Auto-focus first element
      const initialFocusable = getFocusable();
      if (initialFocusable.length > 0) {
        initialFocusable[0]?.focus();
      }

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
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

  // Store scroll state in refs so cleanup can access them
  const originalOverflowRef = useRef<string>('');
  const containerRef_forLock = containerRef;

  useEffect(() => {
    if (!isOpen || !containerRef_forLock.current) return;

    // Lock scroll when modal opens
    if (lockScroll) {
      originalOverflowRef.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    const container = containerRef_forLock.current;

    const previouslyFocusedElement = document.activeElement as HTMLElement;

    const getFocusable = () =>
      Array.from(
        container.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      );

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape && onClose) {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key !== 'Tab') return;
      if (!container.contains(document.activeElement)) return;

      const focusable = getFocusable();
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Auto-focus first element
    if (autoFocus) {
      setTimeout(() => {
        const focusable = getFocusable();
        focusable[0]?.focus();
      }, 50);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Restore scroll when modal closes
      if (lockScroll) {
        document.body.style.overflow = originalOverflowRef.current;
      }
      if (restoreFocus && previouslyFocusedElement) {
        previouslyFocusedElement.focus?.();
      }
    };
  }, [
    isOpen,
    containerRef_forLock,
    closeOnEscape,
    closeOnClickOutside,
    lockScroll,
    autoFocus,
    restoreFocus,
    onClose,
  ]);
}
