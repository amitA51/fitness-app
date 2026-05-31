/**
 * Accessible UI Primitives
 *
 * Reusable accessibility helpers following WCAG 2.1 guidelines.
 * Only the genuinely shared primitives live here:
 * - VisuallyHidden: screen-reader-only content
 * - LiveRegion: polite/assertive dynamic announcements
 *
 * Heavier duplicates (Button/Input/Modal/Tabs/SkipLink/FocusTrap) were removed
 * as dead code — focus trapping is provided by the `useFocusTrap` hook and
 * overlays by `ModalOverlay`.
 */

import type React from 'react';
import { type ReactNode, useEffect, useState } from 'react';

// ============================================================================
// Visually Hidden (screen reader only)
// ============================================================================

interface VisuallyHiddenProps {
  children: ReactNode;
  /** Render as different element */
  as?: 'span' | 'div' | 'p' | 'label';
}

export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({ children, as = 'span' }) => {
  const Element = as;
  return <Element className="sr-only">{children}</Element>;
};

// ============================================================================
// Live Region (for dynamic announcements)
// ============================================================================

interface LiveRegionProps {
  /** Message to announce */
  message: string;
  /** Politeness level */
  politeness?: 'polite' | 'assertive';
  /** Clear message after timeout (ms) */
  clearAfter?: number;
}

export const LiveRegion: React.FC<LiveRegionProps> = ({
  message,
  politeness = 'polite',
  clearAfter,
}) => {
  const [currentMessage, setCurrentMessage] = useState(message);

  useEffect(() => {
    setCurrentMessage(message);

    if (clearAfter && message) {
      const timer = setTimeout(() => setCurrentMessage(''), clearAfter);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [message, clearAfter]);

  return (
    <div role="status" aria-live={politeness} aria-atomic="true" className="sr-only">
      {currentMessage}
    </div>
  );
};
