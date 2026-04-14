// ============================================================================
// SPARKOS FITNESS - zIndex Constants
// ============================================================================

export const zIndex = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  fixed: 300,
  modalBackdrop: 400,
  modal: 1100,
  popover: 1200,
  tooltip: 1300,
  toast: 1400,
  overlay: 1500,
  alert: 10000,
  splash: 19999,
} as const;

// Re-export as Z_INDEX for compatibility
export const Z_INDEX = zIndex;

export default zIndex;
