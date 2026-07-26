// Sheet — canonical bottom-sheet built on <ModalOverlay variant="bottomSheet">.
//
// Replaces every ad-hoc bottom-sheet (the `variant="none"` + custom-motion
// pattern and raw `fixed motion.div` sheets). Provides the standard chrome:
// drag handle, header (title + 44px close button), scrollable body, optional
// sticky footer. RTL-correct via logical properties; honors prefers-reduced
// -motion through ModalOverlay. Focus trap, scroll lock, Esc-to-close, and
// backdrop-click-to-close all come from ModalOverlay.

import { X } from 'lucide-react';
import type React from 'react';
import { useId } from 'react';
import { ModalOverlay } from './ModalOverlay';

export interface SheetProps {
  /** Whether the sheet is open. */
  isOpen: boolean;
  /** Called when the user dismisses (close button, backdrop, or Esc). */
  onClose: () => void;
  /** Sheet title rendered in the header (Hebrew). */
  title: string;
  /** Sheet body content — scrolls when it overflows. */
  children: React.ReactNode;
  /** Optional sticky footer (e.g. action buttons) pinned to the bottom edge. */
  footer?: React.ReactNode;
  /** Accessibility label for the dialog; defaults to `title`. */
  ariaLabel?: string;
  /** CSS selector for the element to focus initially (e.g. the heading for read-only sheets). */
  initialFocusSelector?: string;
}

/**
 * Standard bottom sheet.
 *
 * @example
 * <Sheet isOpen={open} onClose={close} title="בחירת תרגיל" footer={<Button fullWidth>שמירה</Button>}>
 *   <ExercisePicker />
 * </Sheet>
 */
export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  ariaLabel,
  initialFocusSelector,
}) => {
  const titleId = useId();

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onClose}
      variant="bottomSheet"
      ariaLabel={ariaLabel}
      ariaLabelledBy={ariaLabel ? undefined : titleId}
      initialFocusSelector={initialFocusSelector}
    >
      <div
        className="flex flex-col w-full"
        style={{
          background: 'var(--fs-surface)',
          borderTopLeftRadius: 'var(--radius-2xl)',
          borderTopRightRadius: 'var(--radius-2xl)',
          boxShadow: 'var(--shadow-elevated)',
          maxHeight: '85vh',
        }}
      >
        {/* Drag handle — grab here (or the title) to drag the sheet down to
            dismiss. `touch-action: none` lets the pointer drag win over scroll;
            ModalOverlay reads the [data-sheet-drag-handle] marker to start it. */}
        <div
          data-sheet-drag-handle
          className="flex justify-center pt-3 pb-2 shrink-0"
          style={{ touchAction: 'none', cursor: 'grab' }}
          aria-hidden="true"
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 'var(--radius-full)',
              background: 'var(--color-drag-handle)',
            }}
          />
        </div>

        {/* Header — title + circular close */}
        <div
          className="flex items-center justify-between gap-3 px-5 pb-3 shrink-0"
          style={{ borderBottom: '0.5px solid var(--color-separator)' }}
        >
          <h2
            id={titleId}
            data-sheet-drag-handle
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 20,
              letterSpacing: '-0.02em',
              color: 'var(--fs-heading)',
              textAlign: 'start',
              margin: 0,
              touchAction: 'none',
              cursor: 'grab',
            }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="inline-flex items-center justify-center shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2"
            style={{
              // 44px is the HIG minimum. The visual circle stays modest via the
              // icon size; the pressable area is the full square.
              width: 44,
              height: 44,
              borderRadius: 9999,
              color: 'var(--fs-ink)',
              background: 'var(--fs-surface-2)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable body */}
        <div
          className="overflow-y-auto px-5 py-4"
          style={{ flex: '1 1 auto', minHeight: 0, overscrollBehavior: 'contain' }}
        >
          {children}
        </div>

        {/* Optional sticky footer */}
        {footer && (
          <div
            className="px-5 pt-3 shrink-0"
            style={{
              borderTop: '1px solid var(--fs-surface-2)',
              paddingBottom: 'calc(var(--space-4) + env(safe-area-inset-bottom, 0px))',
              background: 'var(--fs-surface)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </ModalOverlay>
  );
};

export default Sheet;
