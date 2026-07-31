// PageHeader — the canonical top-of-page header for standard screens.
//
// Sticky glass header, optional eyebrow, display title, optional back + action.
// Fresh Steel / Obsidian tokens only; Hebrew aria-labels on icon controls.
//
// `size="large"` adds the iOS large-title behaviour: the title starts at 34px
// and compresses to 20px as the page scrolls the first 72px, the eyebrow fades
// out, and the vertical padding tightens — the header becomes a compact bar
// instead of jumping between two states. Driven entirely by MotionValues
// (useScroll → useTransform), so no React state updates per scrolled pixel.

import { type MotionValue, m, useScroll, useTransform } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { type CSSProperties, type ReactNode, memo } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

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
  /** Divider treatment (default hairline separator). */
  divider?: 'accent' | 'none';
  /** Landmark aria-label (defaults to the title). */
  ariaLabel?: string;
  /**
   * `default` — fixed 28px title (existing behaviour).
   * `large`   — iOS large title that collapses to a compact bar on scroll.
   */
  size?: 'default' | 'large';
}

const eyebrowStyle: CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  fontWeight: 400,
  color: 'var(--fs-muted)',
  margin: 0,
  lineHeight: 1.35,
  letterSpacing: '-0.01em',
};

/** Scroll distance over which the large title fully compresses. */
const COLLAPSE_RANGE = 72;

interface CollapseValues {
  fontSize: MotionValue<number> | number;
  paddingTop: MotionValue<string> | string;
  paddingBottom: MotionValue<number> | number;
  eyebrowOpacity: MotionValue<number> | number;
  eyebrowHeight: MotionValue<number> | number;
}

/**
 * MotionValues for the collapsing large title. Reduced motion pins the header to
 * its compact end state instead of animating it while the user scrolls.
 */
function useCollapse(enabled: boolean, reduced: boolean): CollapseValues | null {
  const { scrollY } = useScroll();
  const range = [0, COLLAPSE_RANGE];
  const fontSize = useTransform(scrollY, range, [34, 20]);
  const paddingTop = useTransform(scrollY, range, [
    'max(20px, var(--safe-block-start))',
    'max(10px, var(--safe-block-start))',
  ]);
  const paddingBottom = useTransform(scrollY, range, [16, 10]);
  const eyebrowOpacity = useTransform(scrollY, [0, COLLAPSE_RANGE * 0.6], [1, 0]);
  const eyebrowHeight = useTransform(scrollY, range, [18, 0]);

  if (!enabled) return null;
  if (reduced) {
    return {
      fontSize: 20,
      paddingTop: 'max(10px, var(--safe-block-start))',
      paddingBottom: 10,
      eyebrowOpacity: 1,
      eyebrowHeight: 18,
    };
  }
  return { fontSize, paddingTop, paddingBottom, eyebrowOpacity, eyebrowHeight };
}

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
    size = 'default',
  }) => {
    const reduced = useReducedMotion();
    const collapse = useCollapse(size === 'large', reduced);

    const titleStyle: CSSProperties = {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 28,
      lineHeight: 1.12,
      // Optical sizing lets variable display faces adjust stroke contrast to
      // the rendered size instead of scaling a single design.
      fontOpticalSizing: 'auto',
      letterSpacing: '-0.022em',
      color: 'var(--fs-ink)',
      margin: eyebrow ? '4px 0 0' : 0,
    };

    const shellStyle: CSSProperties = {
      position: sticky ? 'sticky' : undefined,
      top: sticky ? 0 : undefined,
      zIndex: sticky ? 20 : undefined,
      background: sticky ? 'color-mix(in srgb, var(--fs-bg) 78%, transparent)' : 'var(--fs-bg)',
      // Page headers can remain translucent without competing with the nav's
      // 20px material layer when an overlay is open.
      backdropFilter: sticky ? 'saturate(180%) blur(12px)' : undefined,
      WebkitBackdropFilter: sticky ? 'saturate(180%) blur(12px)' : undefined,
      borderBottom: divider === 'accent' ? '0.5px solid var(--color-separator)' : undefined,
      paddingTop: 'max(20px, var(--safe-block-start))',
      // Logical padding needs the direction-aware inset (tokens.css §13):
      // in RTL the inline start edge is physically on the right.
      paddingInlineStart: 'max(20px, var(--safe-inline-start))',
      paddingInlineEnd: 'max(20px, var(--safe-inline-end))',
      paddingBottom: 16,
      display: 'flex',
      alignItems: onBack ? 'center' : 'flex-end',
      justifyContent: 'space-between',
      gap: 12,
    };

    const backButton = onBack ? (
      <button
        type="button"
        onClick={onBack}
        aria-label={backLabel}
        className="inline-flex items-center justify-center shrink-0 transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--fs-bg)]"
        style={{
          width: 44,
          height: 44,
          borderRadius: 9999,
          color: 'var(--fs-ink)',
          background: 'var(--fs-surface-2)',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {/* RTL: "back" points toward the inline-start (right). */}
        <ChevronRight size={22} aria-hidden />
      </button>
    ) : null;

    if (collapse) {
      return (
        <m.header
          aria-label={ariaLabel ?? title}
          style={{
            ...shellStyle,
            paddingTop: collapse.paddingTop,
            paddingBottom: collapse.paddingBottom,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {backButton}
            <div style={{ minWidth: 0 }}>
              {eyebrow != null && (
                <m.div
                  style={{
                    ...eyebrowStyle,
                    opacity: collapse.eyebrowOpacity,
                    height: collapse.eyebrowHeight,
                    overflow: 'hidden',
                  }}
                >
                  {eyebrow}
                </m.div>
              )}
              <m.h1 style={{ ...titleStyle, fontSize: collapse.fontSize }}>{title}</m.h1>
            </div>
          </div>
          {action != null && <div style={{ flexShrink: 0 }}>{action}</div>}
        </m.header>
      );
    }

    return (
      <header aria-label={ariaLabel ?? title} style={shellStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          {backButton}
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
