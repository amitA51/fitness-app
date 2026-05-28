// ============================================================================
// SPARKOS FITNESS - Mobile Keyboard Handling Hook
// Handles mobile keyboard visibility and input focus
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseMobileKeyboardOptions {
  onFocus?: () => void;
  onBlur?: () => void;
  scrollToInput?: boolean;
}

export interface MobileKeyboardState {
  isOpen: boolean;
  height: number;
  keyboardHeight: number;
}

/**
 * Hook for detecting and handling mobile keyboard visibility
 * Provides keyboard height for proper layout adjustments
 */
export function useMobileKeyboard(options: UseMobileKeyboardOptions = {}) {
  const { onFocus, onBlur, scrollToInput = true } = options;

  const [state, setState] = useState<MobileKeyboardState>({
    isOpen: false,
    height: 0,
    keyboardHeight: 0,
  });

  // Detect keyboard using visualViewport API or window innerHeight
  useEffect(() => {
    const updateKeyboardState = () => {
      const visualViewport = window.visualViewport;

      if (visualViewport) {
        // Use Visual Viewport API (modern browsers)
        const keyboardHeight = window.innerHeight - visualViewport.height;
        const isOpen = keyboardHeight > 100; // Threshold for keyboard detection

        setState({
          isOpen,
          height: visualViewport.height,
          keyboardHeight: Math.max(0, keyboardHeight),
        });

        // Scroll input into view if needed
        if (isOpen && scrollToInput) {
          requestAnimationFrame(() => {
            const activeElement = document.activeElement;
            if (activeElement && (activeElement as HTMLElement).scrollIntoView) {
              (activeElement as HTMLElement).scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });
            }
          });
        }
      } else {
        // Fallback: use innerHeight comparison
        const heightDiff = window.innerHeight - window.outerHeight;
        const isOpen = heightDiff < 0 || window.innerHeight < screen.height * 0.7;

        setState({
          isOpen,
          height: window.innerHeight,
          keyboardHeight: isOpen ? screen.height - window.innerHeight : 0,
        });
      }
    };

    // Use Visual Viewport API if available
    const visualViewport = window.visualViewport;

    if (visualViewport) {
      visualViewport.addEventListener('resize', updateKeyboardState);
      visualViewport.addEventListener('scroll', updateKeyboardState);
    }

    // Fallback listeners
    window.addEventListener('resize', updateKeyboardState);
    window.addEventListener('orientationchange', updateKeyboardState);

    // Initial state
    updateKeyboardState();

    return () => {
      if (visualViewport) {
        visualViewport.removeEventListener('resize', updateKeyboardState);
        visualViewport.removeEventListener('scroll', updateKeyboardState);
      }
      window.removeEventListener('resize', updateKeyboardState);
      window.removeEventListener('orientationchange', updateKeyboardState);
    };
  }, [scrollToInput]);

  // Handle input focus/blur for keyboard events
  useEffect(() => {
    const handleFocus = () => onFocus?.();
    const handleBlur = () => onBlur?.();

    document.addEventListener('focusin', handleFocus);
    document.addEventListener('focusout', handleBlur);

    return () => {
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('focusout', handleBlur);
    };
  }, [onFocus, onBlur]);

  // CSS variable for keyboard height
  useEffect(() => {
    if (state.isOpen) {
      document.documentElement.style.setProperty('--keyboard-height', `${state.keyboardHeight}px`);
    } else {
      document.documentElement.style.removeProperty('--keyboard-height');
    }
  }, [state.isOpen, state.keyboardHeight]);

  return state;
}

// ============================================================================
// Input Auto-Focus Hook
// ============================================================================

export interface UseInputFocusOptions {
  autoFocus?: boolean;
  selectAll?: boolean;
  delay?: number;
}

/**
 * Hook for managing input focus with mobile keyboard support
 */
export function useInputFocus<T extends HTMLInputElement | HTMLTextAreaElement = HTMLInputElement>(
  options: UseInputFocusOptions = {}
) {
  const { autoFocus = false, selectAll = false, delay = 0 } = options;

  const inputRef = useRef<T | null>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      const timeout = setTimeout(() => {
        inputRef.current?.focus();
        if (selectAll && inputRef.current) {
          inputRef.current.select();
        }
      }, delay);

      return () => clearTimeout(timeout);
    }
  }, [autoFocus, selectAll, delay]);

  const setRef = useCallback((el: T | null) => {
    inputRef.current = el;
  }, []);

  const focus = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.focus();
      if (selectAll) {
        inputRef.current?.select();
      }
    }, 10);
  }, [selectAll]);

  const blur = useCallback(() => {
    inputRef.current?.blur();
  }, []);

  return {
    ref: setRef,
    inputRef,
    focus,
    blur,
  };
}

// ============================================================================
// Mobile Input Utilities
// ============================================================================

/**
 * Scroll element into view with keyboard offset
 */
export function scrollIntoViewWithKeyboard(element: HTMLElement) {
  const keyboardHeight = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--keyboard-height') || '0'
  );

  const rect = element.getBoundingClientRect();
  const viewportHeight = window.visualViewport?.height || window.innerHeight;
  const visibleBottom = viewportHeight - keyboardHeight;

  // Calculate if element is obscured by keyboard
  if (rect.bottom > visibleBottom - 20) {
    const offset = rect.bottom - visibleBottom + 20;
    window.scrollBy({
      top: offset,
      behavior: 'smooth',
    });
  }
}

/**
 * Input types for mobile keyboards
 */
export const INPUT_MODES = {
  text: 'text',
  numeric: 'numeric',
  decimal: 'decimal',
  tel: 'tel',
  search: 'search',
  email: 'email',
  url: 'url',
} as const;

/**
 * Prevent zoom on double-tap for inputs
 */
export function preventInputZoom() {
  let lastTouchEnd = 0;

  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    },
    false
  );
}
