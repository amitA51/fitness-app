// ============================================================================
// SectionCard — the asymmetric, accent-railed surface every Progress section
// repeats. One definition replaces the inline `cardStyle` + rail `<div>` that
// was copy-pasted across the weight/measurements/recovery/strength tabs.
// ============================================================================

import { ChevronDown } from 'lucide-react';
import type React from 'react';
import { memo, useState } from 'react';

interface SectionCardProps {
  children: React.ReactNode;
  /** Render the accent rail on the inline-start edge (default true). */
  rail?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const SectionCard = memo(function SectionCard({
  children,
  rail = true,
  className,
  style,
}: SectionCardProps) {
  return (
    <div
      className={className}
      style={{
        background: 'var(--fs-surface)',
        borderRadius: 'var(--radius-asymmetric)',
        border: '1px solid var(--fs-surface-2)',
        boxShadow: 'var(--shadow-card)',
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {rail && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            insetInlineStart: 0,
            top: 0,
            bottom: 0,
            width: 4,
            background: 'var(--fs-accent)',
            borderStartStartRadius: 'var(--radius-asymmetric)',
            borderEndStartRadius: 'var(--radius-asymmetric)',
          }}
        />
      )}
      {children}
    </div>
  );
});

export default SectionCard;

// ============================================================================
// AdvancedSection — the ONE progressive-disclosure idiom on Progress.
// ============================================================================
// Each tab keeps at its top level only what answers "how is training going",
// and puts the analysis behind this expander. Same component, same `מתקדם`
// label, same geometry (full-width, 44px, hairline border, accent label,
// rotating chevron) in every tab — two different expander patterns on one
// screen is the density problem wearing a disguise. The geometry deliberately
// matches the PR-board `הצג הכל` button already shipping in StrengthSection.
//
// Children are UNMOUNTED while collapsed, so a closed section costs no render
// work. The chevron rotates on `transform` only; the global
// prefers-reduced-motion rule (`global.css:663`) collapses its duration.

export const AdvancedSection = memo(function AdvancedSection({
  children,
  id,
  label = 'מתקדם',
}: {
  children: React.ReactNode;
  /** Unique id — the panel gets `${id}-panel` for aria-controls. */
  id: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        className="active:scale-[0.98] motion-reduce:active:scale-100"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          width: '100%',
          minHeight: 44,
          background: 'transparent',
          border: '1px solid var(--fs-surface-2)',
          borderRadius: 10,
          cursor: 'pointer',
          fontFamily: 'var(--font-hebrew)',
          fontSize: 13,
          fontWeight: 600,
          // Accent-coloured label on a light PAGE surface — so it must be the
          // text-safe accent, not the raw fill mint. Raw --fs-accent measured
          // 1.75:1 here in the default light theme (reports/visual-qa-s20.md F1);
          // --fs-accent-text is the same hue scaled 0.55 and clears AA, while
          // resolving BACK to --fs-accent in dark and both high-contrast states,
          // where the mint already passes. The chevron below inherits it via
          // currentColor.
          color: 'var(--fs-accent-text)',
          transition: 'transform 0.1s var(--ease-out, ease-out)',
        }}
      >
        {label}
        <ChevronDown
          size={16}
          aria-hidden="true"
          style={{
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s var(--ease-out, ease-out)',
          }}
        />
      </button>
      <div id={`${id}-panel`}>
        {open && (
          <div className="space-y-4" style={{ marginTop: 16 }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
});
