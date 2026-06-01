/**
 * Hairline divider between settings rows. Replaces the repeated inline
 * `style={{ height: 1, background: var(--fs-surface-2), ... }}` literals across
 * the sections with a single component. Uses logical inline margins so the
 * inset mirrors correctly in both RTL and LTR.
 */
export function Divider() {
  return (
    <div
      aria-hidden="true"
      style={{ height: '1px', background: 'var(--fs-surface-2)', marginInline: '16px' }}
    />
  );
}

export default Divider;
