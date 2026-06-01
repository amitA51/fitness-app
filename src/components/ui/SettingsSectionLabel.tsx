import type React from 'react';

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
}: {
  children: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="mb-3 px-1 flex items-center justify-between gap-3">
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 16,
          color: 'var(--fs-ink)',
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
