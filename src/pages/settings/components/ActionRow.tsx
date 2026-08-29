// ============================================================================
// ActionRow — a full-width "icon + label" button row inside a SettingsCard.
// ============================================================================
// Extracted verbatim from the old ExportSection's local `ExportRow` when that
// section was split into `BackupSection` (מתקדם) and `WeeklyReportSection`
// (top level), so both share one row definition instead of copy-pasting it.
//
// `textAlign: 'start'` keeps the label edge-anchored in both RTL and LTR.

import type React from 'react';
import { IconBox } from './IconBox';

export function ActionRow({
  icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 16px',
        minHeight: '52px',
        border: 'none',
        background: 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        width: '100%',
        textAlign: 'start',
      }}
    >
      <IconBox>{icon}</IconBox>
      <span
        className="flex-1"
        style={{
          fontFamily: 'var(--font-hebrew)',
          fontSize: '15px',
          fontWeight: 500,
          color: 'var(--fs-ink)',
          textAlign: 'start',
        }}
      >
        {label}
      </span>
    </button>
  );
}

export default ActionRow;
