// useMountWhileOpen — mount gate for portal surfaces (sheets, modals, pickers).
//
// WHY THIS EXISTS
// Rendering `<Sheet isOpen={false} />` is not free. Every closed sheet still
// walks Sheet → ModalOverlay, which runs a focus trap, a scroll-lock effect,
// motion values, `AnimatePresence` and `createPortal` on every parent render.
// With five sheets permanently mounted on the active-workout screen, a single
// tap on the weight `+` button was measured re-rendering `Sheet x5`,
// `ModalOverlay x5` and `AnimatePresence x6` — roughly a third to a half of all
// renders for that tap came from surfaces the user could not see.
//
// The naive fix, `{isOpen && <Sheet .../>}`, cuts the close animation: the
// subtree unmounts before `AnimatePresence` inside `ModalOverlay` can play its
// exit, so the sheet vanishes instead of sliding away. This hook keeps the
// subtree alive for the exit duration and only then drops it, so closed sheets
// cost nothing AND dismissal still animates.
//
// Usage:
//   const toolsMounted = useMountWhileOpen(showToolsSheet);
//   {toolsMounted && <WorkoutToolsSheet isOpen={showToolsSheet} ... />}
//
// Note `isOpen` is still passed through — the sheet needs it to run its own
// enter/exit; this hook only decides whether the sheet exists at all.

import { useEffect, useRef, useState } from 'react';

/**
 * ModalOverlay's slowest exit is the content layer at 0.42s. 480ms clears it
 * with a small margin so the unmount never clips the tail of the animation.
 */
export const OVERLAY_EXIT_MS = 480;

/**
 * True while a surface should exist in the tree: from the moment it opens until
 * its exit animation has finished. False before the first open, so a surface the
 * user never touches is never constructed.
 *
 * @param isOpen  The surface's own open state.
 * @param exitMs  Exit animation duration to wait out. Defaults to {@link OVERLAY_EXIT_MS}.
 */
export function useMountWhileOpen(isOpen: boolean, exitMs: number = OVERLAY_EXIT_MS): boolean {
  const [mounted, setMounted] = useState(isOpen);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Reopening during the exit window cancels the pending unmount, so a
      // fast close-then-open reuses the live subtree instead of tearing it down.
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setMounted(true);
      return;
    }

    // Already unmounted (or never opened) — nothing to wait for.
    if (!mounted) return;

    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      setMounted(false);
    }, exitMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isOpen, exitMs, mounted]);

  return mounted;
}

export default useMountWhileOpen;
