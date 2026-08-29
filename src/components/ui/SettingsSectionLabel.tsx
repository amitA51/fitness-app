import type React from 'react';

// The sticky `SettingsJumpNav` chip row that used to live here was deleted with
// the Settings regroup. A jump menu is a screen admitting it is too long to
// scroll, which was the complaint rather than the fix; it also shipped two
// defects — a "מאמן" chip that scrolled trainees to an empty div (CoachSection
// renders null for non-coaches), and chips computing to ~31px against the 44px
// touch floor. Five grouped headings replace it, so the premise is gone.

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
