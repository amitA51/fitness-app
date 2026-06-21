import type React from 'react';

/**
 * Sticky in-page jump nav for the Settings screen. A horizontally-scrollable
 * mono-kicker chip row that anchor-scrolls to the section groups (each group
 * gets a matching `id` + `scroll-margin-top` so it clears the sticky header).
 * Replaces the long flat scroll-hunt with one-tap section access.
 */
export interface SettingsJumpItem {
  id: string;
  label: string;
}

export function SettingsJumpNav({
  items,
  top,
}: {
  items: readonly SettingsJumpItem[];
  /** Sticky offset — sits flush under the Settings header. */
  top: number;
}) {
  return (
    <nav
      aria-label="ניווט מהיר בהגדרות"
      className="overflow-x-auto"
      style={{
        position: 'sticky',
        top,
        zIndex: 19,
        background: 'var(--fs-bg)',
        // Hairline under the chip row so it reads as a band, not floating chips.
        borderBottom: '1px solid var(--fs-surface-2)',
        // Bleed to the screen edges so the scroll feels full-width.
        // Matches the page gutter (px-5 = 20px) so the chip row reaches both edges.
        marginInline: '-20px',
        paddingInline: '20px',
        paddingBlock: '10px',
      }}
    >
      <ul
        className="flex gap-2"
        style={{ listStyle: 'none', margin: 0, padding: 0, width: 'max-content' }}
      >
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="inline-flex items-center active:scale-[0.98] transition-transform"
              style={{
                whiteSpace: 'nowrap',
                padding: '6px 12px',
                borderRadius: 'var(--radius-full, 999px)',
                background: 'var(--fs-surface)',
                border: '1px solid var(--fs-surface-2)',
                // mono kicker — AA on fs-bg via fs-ink (muted would be too faint
                // for an interactive control).
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--fs-ink)',
                textDecoration: 'none',
              }}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Section header — Hebrew display heading with an optional `trailing` slot.
 *
 * The old `num` / `titleEn` props were dead (rendered nothing — `void num;
 * void titleEn;`) so they have been removed and every call site updated.
 * `trailing` renders inline-end of the heading; autosaving sections pass a
 * <SavedIndicator/> there so the "נשמר" flash sits next to the title now that
 * the Save buttons are gone.
 */
export function SectionLabel({
  children,
  trailing,
  tone = 'default',
}: {
  children: React.ReactNode;
  trailing?: React.ReactNode;
  /** 'danger' tints the heading with --color-error for danger-zone sections. */
  tone?: 'default' | 'danger';
}) {
  return (
    <div className="mb-3 px-1 flex items-center justify-between gap-3">
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 16,
          color: tone === 'danger' ? 'var(--color-error)' : 'var(--fs-ink)',
          margin: 0,
        }}
      >
        {children}
      </h3>
      {trailing}
    </div>
  );
}

export default SectionLabel;
