// ============================================================================
// Z-Index Constants — single source of truth (mirrors tailwind.config.js)
// ============================================================================

export const zIndex = {
  base: 0,
  sticky: 100,
  nav: 200,
  dropdown: 300,
  overlay: 1000,
  modal: 1100,
  toast: 1500,
  errorBoundary: 1600,
  splash: 2000,
} as const;

// Re-export as Z_INDEX for compatibility
export const Z_INDEX = zIndex;

export default zIndex;
