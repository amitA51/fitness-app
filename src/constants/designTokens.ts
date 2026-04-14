// ============================================================================
// SPARKOS FITNESS - Design Tokens
// ============================================================================

export const COLORS = {
  primary: '#6366f1',
  secondary: '#8b5cf6',
  accent: '#ec4899',
  background: '#0f0f23',
  surface: '#1a1a2e',
  text: '#ffffff',
  textSecondary: '#a1a1aa',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
} as const;

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
} as const;

export const BORDER_RADIUS = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
} as const;

export const FONT_SIZES = {
  xs: '12px',
  sm: '14px',
  md: '16px',
  lg: '18px',
  xl: '20px',
  '2xl': '24px',
  '3xl': '30px',
  '4xl': '36px',
} as const;

export const Z_INDEX = {
  dropdown: 100,
  modal: 200,
  toast: 300,
  tooltip: 400,
} as const;
