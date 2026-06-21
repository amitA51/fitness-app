// PageHeader — the canonical top-of-page header for standard screens.
//
// Until now every screen hand-rolled its own header. Five of them already shared
// one idiom almost verbatim — sticky on var(--fs-bg), a 2px var(--fs-accent)
// bottom border, safe-area-aware padding, an optional eyebrow line above a
// Bricolage display title, and an optional trailing action — but drifted on the
// details (title 26/800 vs 22/900, subtitle present or not, some dead-ended with
// no back). This is the single source of truth they converge onto.
//
// Fresh Steel / Obsidian: all colors via tokens (both modes); numbers passed in
// the eyebrow render dir="ltr" by the caller; icon-only actions/back carry a
// Hebrew aria-label. The safe-area padding (max(20px, env(safe-area-inset-*)))
// handles the PWA notch and was previously duplicated across every screen.

import { ChevronRight } from 'lucide-react';
import { type CSSProperties, type ReactNode, memo } from 'react';

interface PageHeaderProps {
  /** Page title (Hebrew). Rendered as the h1. */
  title: string;
  /** Kicker/eyebrow line ABOVE the title (date, count, calorie progress, subtitle).
   *  A ReactNode so callers can bidi-isolate numeric spans and inline badges. */
  eyebrow?: ReactNode;
  /** Trailing end-aligned action slot (e.g. a settings icon or cleanup button). */
  action?: ReactNode;
  /** When provided, renders a start-aligned ghost back chevron that calls this. */
  onBack?: () => void;
  /** aria-label for the back button (default "חזרה"). */
  backLabel?: string;
  /** Stick to the top of the scroll container (default true). */
  sticky?: boolean;
  /** Divider treatment (default the brand 2px accent line). */
  divider?: 'accent' | 'none';
  /** Landmark aria-label (defaults to the title). */
  ariaLabel?: string;
}

const eyebrowStyle: CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--fs-muted)',
  margin: 0,
  lineHeight: 1.4,
};

const PageHeader = memo<PageHeaderProps>(
  ({
    title,
    eyebrow,
    action,
    onBack,
    backLabel = 'חזרה',
    sticky = true,
    divider = 'accent',
    ariaLabel,
  }) => {
    const titleStyle: CSSProperties = {
      fontFamily: 'var(--font-display)',
      fontWeight: 800,
      fontSize: 26,
      lineHeight: 1.15,
      letterSpacing: '-0.01em',
      color: 'var(--fs-ink)',
      margin: eyebrow ? '4px 0 0' : 0,
    };

    return (
      <header
        aria-label={ariaLabel ?? title}
        style={{
          position: sticky ? 'sticky' : undefined,
          top: sticky ? 0 : undefined,
          zIndex: sticky ? 20 : undefined,
          background: 'var(--fs-bg)',
          borderBottom: divider === 'accent' ? '2px solid var(--fs-accent)' : undefined,
          paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
          paddingInlineStart: 'max(20px, env(safe-area-inset-left, 20px))',
          paddingInlineEnd: 'max(20px, env(safe-area-inset-right, 20px))',
          paddingBottom: 16,
          display: 'flex',
          alignItems: onBack ? 'center' : 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label={backLabel}
              className="inline-flex items-center justify-center shrink-0 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fs-bg)]"
              style={{
                width: 44,
                height: 44,
                borderRadius: 'var(--radius-md)',
                color: 'var(--fs-muted)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {/* RTL: "back" points toward the inline-start (right). */}
              <ChevronRight size={22} aria-hidden />
            </button>
          )}
          <div style={{ minWidth: 0 }}>
            {eyebrow != null && <div style={eyebrowStyle}>{eyebrow}</div>}
            <h1 style={titleStyle}>{title}</h1>
          </div>
        </div>
        {action != null && <div style={{ flexShrink: 0 }}>{action}</div>}
      </header>
    );
  }
);

PageHeader.displayName = 'PageHeader';

export default PageHeader;
