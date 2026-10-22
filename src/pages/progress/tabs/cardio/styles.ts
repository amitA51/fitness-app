// Shared inline styles of the cardio cards (Progress › אימונים › אירובי).

export const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minHeight: 48,
  padding: '8px 0',
  borderBottom: '1px solid var(--fs-surface-2)',
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  color: 'var(--fs-ink)',
} as const;

export const titleStyle = {
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--fs-heading)',
} as const;

export const mutedStyle = {
  margin: 0,
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  lineHeight: 1.5,
  color: 'var(--fs-muted)',
} as const;
