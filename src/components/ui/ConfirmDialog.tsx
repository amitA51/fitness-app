// ConfirmDialog — canonical confirm/cancel modal built on <ModalOverlay
// variant="modal">. Replaces ad-hoc confirm modals and `window.confirm`.
// Uses Button core variants for actions; RTL-correct; reduced-motion via
// ModalOverlay. Focus trap, scroll lock, Esc, and backdrop dismissal (mapped to
// onCancel) all come from ModalOverlay.

import { AlertTriangle, Info, type LucideIcon, Trash2 } from 'lucide-react';
import type React from 'react';
import { useId } from 'react';
import { Button } from './Button';
import { ModalOverlay } from './ModalOverlay';

export type ConfirmVariant = 'danger' | 'warning' | 'info';

export interface ConfirmDialogProps {
  /** Whether the dialog is open. */
  isOpen: boolean;
  /** Called when the user confirms the action. */
  onConfirm: () => void;
  /** Called on cancel, backdrop click, or Esc. */
  onCancel: () => void;
  /** Dialog title (Hebrew). */
  title: string;
  /** Explanatory body text (Hebrew). */
  description: string;
  /** Confirm button label. Defaults to "אישור". */
  confirmLabel?: string;
  /** Cancel button label. Defaults to "ביטול". */
  cancelLabel?: string;
  /** Intent — drives the icon tint and confirm-button variant. Defaults to `info`. */
  variant?: ConfirmVariant;
}

const VARIANT_META: Record<
  ConfirmVariant,
  { icon: LucideIcon; tint: string; confirm: 'danger' | 'primary' }
> = {
  danger: { icon: Trash2, tint: 'var(--color-error)', confirm: 'danger' },
  warning: { icon: AlertTriangle, tint: 'var(--fs-warn)', confirm: 'primary' },
  info: { icon: Info, tint: 'var(--fs-accent)', confirm: 'primary' },
};

/**
 * Confirm/cancel dialog.
 *
 * @example
 * <ConfirmDialog isOpen={open} variant="danger" title="מחיקת תבנית"
 *   description="הפעולה אינה הפיכה." confirmLabel="מחיקה"
 *   onConfirm={remove} onCancel={close} />
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = 'אישור',
  cancelLabel = 'ביטול',
  variant = 'info',
}) => {
  const titleId = useId();
  const descId = useId();
  const meta = VARIANT_META[variant];
  const Icon = meta.icon;

  return (
    <ModalOverlay
      isOpen={isOpen}
      onClose={onCancel}
      variant="modal"
      ariaLabelledBy={titleId}
      ariaDescribedBy={descId}
    >
      <div className="w-full max-w-sm p-6 flex flex-col gap-4" style={{ textAlign: 'start' }}>
        <div className="flex items-start gap-3">
          <div
            className="inline-flex items-center justify-center shrink-0"
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              background: `color-mix(in srgb, ${meta.tint} 14%, transparent)`,
              color: meta.tint,
            }}
          >
            <Icon size={22} aria-hidden={true} />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <h2
              id={titleId}
              className="font-bold"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-title)',
                color: 'var(--fs-heading)',
                margin: 0,
              }}
            >
              {title}
            </h2>
            <p
              id={descId}
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-body)',
                color: 'var(--fs-muted)',
                margin: 0,
                lineHeight: 'var(--leading-normal)',
              }}
            >
              {description}
            </p>
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-2">
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={meta.confirm} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </ModalOverlay>
  );
};

export default ConfirmDialog;
