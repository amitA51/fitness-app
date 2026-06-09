/**
 * MASTHEAD — FS brand lockup
 */

import { m } from 'framer-motion';
import { useReducedMotion } from '../../../hooks/useReducedMotion';

export function Masthead() {
  const reducedMotion = useReducedMotion();
  return (
    <m.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full px-5 pt-8 pb-6 text-center"
      style={{
        background: 'var(--fs-bg)',
        borderBottom: '2px solid var(--fs-accent)',
        boxShadow: 'var(--shadow-glow-accent)',
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
              // ink-on-accent, not fs-heading — fs-heading is near-white in dark
              // mode and vanishes on the bright mint accent block
              color: 'var(--color-ink-on-accent)',
              lineHeight: 1,
            }}
          >
            FS
          </span>
        </div>
      </div>

      {/* Tagline — focal word "התקדמות" carries the mint accent */}
      <m.p
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.02 }}
        animate={
          reducedMotion
            ? { opacity: 1 }
            : { opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
        }
        className="leading-snug"
        style={{
          fontFamily: '"Bricolage Grotesque", var(--font-display)',
          fontWeight: 800,
          fontSize: '30px',
          color: 'var(--fs-ink)',
          letterSpacing: '-0.02em',
        }}
      >
        כתוב סטים. תראה <span style={{ color: 'var(--fs-accent)' }}>התקדמות</span>.
      </m.p>

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
