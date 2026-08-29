// ============================================================================
// SettingsGroup — the ONE top-level grouping idiom on the Settings screen.
// ============================================================================
// Settings used to be 16 flat sections plus a sticky jump nav. It is now five
// groups, and this renders a group's heading + its stack.
//
// Two heading levels, deliberately:
//   • this group heading — display face, 20px/700 (the "Title" step in
//     DESIGN.md's scale), the only thing a user scans to find a setting;
//   • `SectionLabel` — display face, 16px/700, the card label INSIDE a group,
//     used only where a group holds more than one distinct card.
// A group whose single card would repeat the group's own words renders the card
// with `showLabel={false}` instead, so no text appears twice.
//
// Spacing is on the token scale (--space-*), not eyeballed.

import type React from 'react';

export function SettingsGroup({
  title,
  children,
  trailing,
}: {
  /** Hebrew group heading — the scannable top-level label. */
  title: string;
  children: React.ReactNode;
  /** Optional inline-end slot (e.g. a SavedIndicator for the whole group). */
  trailing?: React.ReactNode;
}) {
  return (
    <section
      style={{ marginBottom: 'var(--space-10, 40px)' }}
      aria-labelledby={`settings-group-${encodeURIComponent(title)}`}
    >
      <div
        className="flex items-center justify-between gap-3"
        style={{ marginBottom: 'var(--space-4, 16px)', paddingInline: 4 }}
      >
        <h2
          id={`settings-group-${encodeURIComponent(title)}`}
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 20,
            letterSpacing: '-0.01em',
            color: 'var(--fs-ink)',
            margin: 0,
            textAlign: 'start',
          }}
        >
          {title}
        </h2>
        {trailing}
      </div>
      {children}
    </section>
  );
}

export default SettingsGroup;
