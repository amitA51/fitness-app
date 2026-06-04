/**
 * MASTHEAD — FS brand lockup
 */

import { m } from 'framer-motion';

export function Masthead() {
  return (
    <m.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full px-5 pt-8 pb-6 text-center"
      style={{
        background: 'var(--fs-bg)',
        borderBottom: '2px solid var(--fs-accent)',
      }}
    >
      {/* FS Brand Mark */}
      <div className="flex items-center justify-center gap-3 mb-3">
        <div
          className="w-14 h-14 flex items-center justify-center"
          style={{
            background: 'var(--fs-accent)',
            borderRadius: 0,
          }}
        >
          <span
            style={{
              fontFamily: '"Bricolage Grotesque", var(--font-display)',
              fontWeight: 800,
              fontSize: '28px',
              color: 'var(--fs-heading)',
              lineHeight: 1,
            }}
          >
            FS
          </span>
        </div>
      </div>

      {/* Tagline */}
      <p
        className="leading-snug fade-rise-in"
        style={{
          fontFamily: '"Bricolage Grotesque", var(--font-display)',
          fontWeight: 600,
          fontSize: '22px',
          color: 'var(--fs-ink)',
          letterSpacing: '-0.01em',
        }}
      >
        כתוב סטים. תראה התקדמות.
      </p>

      {/* Brief description */}
      <p
        className="mt-3 max-w-[280px] mx-auto"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: '14px',
          // fs-muted, not text-on-navy — this masthead sits on fs-bg, which is
          // LIGHT in light mode (text-on-navy made the line invisible there)
          color: 'var(--fs-muted)',
          lineHeight: 1.5,
        }}
      >
        רשמו אימונים, עקבו אחר משקלים וגלו איך הגוף שלכם מתפתח עם הזמן
      </p>
    </m.div>
  );
}
