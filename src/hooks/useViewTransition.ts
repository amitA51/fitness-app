// ============================================================================
// SPARKOS FITNESS - View Transitions Hook
// Provides smooth page transitions using the View Transitions API
// ============================================================================

import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface UseViewTransitionOptions {
  skipTransition?: boolean;
  duration?: number;
}

interface ViewTransitionOptions {
  skipTransition?: boolean;
  viewTransitionName?: string;
}

/**
 * Hook for triggering view transitions with proper fallback
 */
export function useViewTransition(options: UseViewTransitionOptions = {}) {
  const navigate = useNavigate();
  const isTransitioning = useRef(false);
  const { skipTransition = false, duration = 300 } = options;

  const supportsViewTransitions =
    typeof document !== 'undefined' && 'startViewTransition' in document;

  const transitionStyle = {
    '--vt-duration': `${duration}ms`,
  };

  const handleNavigate = useCallback(
    (to: string, opts?: ViewTransitionOptions) => {
      if (isTransitioning.current) return;

      const shouldSkip = opts?.skipTransition ?? skipTransition;

      if (supportsViewTransitions && !shouldSkip) {
        isTransitioning.current = true;

        const transition = document.startViewTransition(() => {
          navigate(to);
          return new Promise((resolve) => setTimeout(resolve, 50));
        });

        const cleanup = () => {
          setTimeout(() => {
            isTransitioning.current = false;
          }, duration);
        };

        const done: Promise<unknown> | undefined =
          transition?.finished ?? transition?.updateCallbackDone;
        if (done && typeof done.then === 'function') {
          done.then(cleanup, cleanup);
        } else {
          cleanup();
        }
      } else {
        navigate(to);
      }
    },
    [navigate, skipTransition, supportsViewTransitions, duration]
  );

  return {
    navigate: handleNavigate,
    supportsViewTransitions,
    isTransitioning: isTransitioning.current,
    transitionStyle,
  };
}

/**
 * CSS for view transitions - add to global.css or component
 */
export const VIEW_TRANSITION_STYLES = `
  /* View Transitions API styles */
  @supports (view-transition-name: none) {
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation-duration: var(--vt-duration, 300ms);
      animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Fade + slide for page transitions */
    ::view-transition-old(root) {
      animation-name: vt-fade-out;
    }

    ::view-transition-new(root) {
      animation-name: vt-fade-in;
    }

    @keyframes vt-fade-out {
      from { opacity: 1; transform: translateX(0); }
      to { opacity: 0; transform: translateX(-8px); }
    }

    @keyframes vt-fade-in {
      from { opacity: 0; transform: translateX(8px); }
      to { opacity: 1; transform: translateX(0); }
    }

    /* RTL support */
    [dir="rtl"] ::view-transition-old(root) {
      animation-name: vt-fade-out-rtl;
    }

    [dir="rtl"] ::view-transition-new(root) {
      animation-name: vt-fade-in-rtl;
    }

    @keyframes vt-fade-out-rtl {
      from { opacity: 1; transform: translateX(0); }
      to { opacity: 0; transform: translateX(8px); }
    }

    @keyframes vt-fade-in-rtl {
      from { opacity: 0; transform: translateX(-8px); }
      to { opacity: 1; transform: translateX(0); }
    }

    /* Named transitions for shared elements */
    ::view-transition-old(card-hero),
    ::view-transition-new(card-hero) {
      animation-duration: 400ms;
    }

    ::view-transition-old(workout-set),
    ::view-transition-new(workout-set) {
      animation-duration: 250ms;
    }
  }

  /* Fallback styles for browsers without View Transitions API */
  @supports not (view-transition-name: none) {
    main {
      animation: page-fade-in 200ms ease-out;
    }
  }

  @keyframes page-fade-in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

/**
 * Utility to add view-transition-name to elements for shared element transitions
 */
export function setViewTransitionName(element: HTMLElement | null, name: string | null) {
  if (element) {
    element.style.viewTransitionName = name || '';
  }
}

/**
 * Hook for managing view transition names on specific elements
 */
export function useViewTransitionName(name: string | null) {
  const elementRef = useRef<HTMLElement | null>(null);

  const setRef = useCallback(
    (element: HTMLElement | null) => {
      elementRef.current = element;
      setViewTransitionName(element, name);
    },
    [name]
  );

  return setRef;
}
