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
): undefined | { containerRef: React.RefObject<HTMLDivElement> } {
  const isLegacyMode = typeof refOrActive === 'boolean' || refOrActive === undefined;

  // Always allocate the internal ref (unconditional hook call).
  const internalRef = useRef<HTMLDivElement>(null);

  // Derive the effective container ref and active state regardless of mode.
  const containerRef = isLegacyMode ? internalRef : refOrActive;
  const isActive = isLegacyMode ? (refOrActive ?? true) : (options?.isOpen ?? true);

  const {
    onClose,
    closeOnEscape = true,
    lockScroll = !isLegacyMode,
    autoFocus = !isLegacyMode,
    restoreFocus = !isLegacyMode,
    initialFocus,
  } = isLegacyMode ? {} : options || {};

  const originalOverflowRef = useRef<string>('');
  const autoFocusTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const previouslyFocusedElement = document.activeElement as HTMLElement;

    // Lock scroll when modal opens (new mode only)
    if (lockScroll) {
      originalOverflowRef.current = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

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

    // Auto-focus the initialFocus selector when provided (e.g. the safe action
    // in a destructive confirm), otherwise the first focusable element.
    if (autoFocus) {
      autoFocusTimerRef.current = setTimeout(() => {
        const preferred = initialFocus ? container.querySelector<HTMLElement>(initialFocus) : null;
        (preferred ?? getFocusable()[0])?.focus();
      }, 50);
    } else if (isLegacyMode) {
      // Legacy mode: immediate focus without delay
      const initialFocusable = getFocusable();
      if (initialFocusable.length > 0) {
        initialFocusable[0]?.focus();
      }
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (autoFocusTimerRef.current) clearTimeout(autoFocusTimerRef.current);
      if (lockScroll) {
        document.body.style.overflow = originalOverflowRef.current;
      }
      if (restoreFocus && previouslyFocusedElement) {
        previouslyFocusedElement.focus?.();
      }
    };
  }, [
    isActive,
    containerRef,
    closeOnEscape,
    onClose,
    lockScroll,
    autoFocus,
    restoreFocus,
    initialFocus,
    isLegacyMode,
  ]);

  if (isLegacyMode) {
    return { containerRef: internalRef };
  }
}
