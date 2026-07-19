import type React from 'react';

/**
 * The square 32×32 icon container used throughout the settings rows. Purely
 * decorative — it sits inside rows whose own min-height (≥52px) and interactive
 * control already satisfy the 44px touch target, so the box itself stays 32px.
 *
 * `tone` picks the fill/foreground pairing:
 *  - `surface` (default): muted surface chip for neutral rows.
 *  - `accent`: accent fill for emphasised rows (e.g. connected cloud).
 */
interface IconBoxProps {
  children: React.ReactNode;
  tone?: 'surface' | 'accent';
}

export function IconBox({ children, tone = 'surface' }: IconBoxProps) {
  const palette =
    tone === 'accent'
      ? { background: 'var(--fs-accent)', color: 'var(--fs-primary)' }
      : { background: 'var(--fs-surface-2)', color: 'var(--fs-heading)' };

  return (
    <div
      className="w-8 h-8 shrink-0 flex items-center justify-center"
      style={{ ...palette, borderRadius: 12 }}
    >
      {children}
    </div>
  );
}

export default IconBox;
