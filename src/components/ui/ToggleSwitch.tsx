import { m } from 'framer-motion';
import React, { useCallback, useEffect, useId, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { triggerHaptic } from '../../utils/haptics';

interface ToggleSwitchProps {
  /** Whether the switch is on */
  checked: boolean;
  /** Callback when the switch state changes */
  onChange: (checked: boolean) => void;
  /** Optional ID for accessibility */
  id?: string;
  /** Optional label text */
  label?: string;
  /** Whether the switch is disabled */
  disabled?: boolean;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

// ----------------------------------------------------------------------------
// Apple-alignment pass
// ----------------------------------------------------------------------------
// Previously: 40x24 track with a 2px radius (a sharp rectangle), a knob that
// scaled to 0.9 on press, and a reduced-motion check evaluated ONCE at module
// load — so toggling the OS or in-app preference at runtime did nothing.
//
// Now: the `md` size matches the iOS system switch (51x31 track, 27px knob,
// fully rounded), the press no longer shrinks the knob (a system switch never
// does; the travel itself is the feedback), and reduced motion is read live from
// the shared hook so the in-app "הפחתת אנימציות" setting applies here too.
const sizeConfig = {
  sm: {
    trackW: 40,
    trackH: 24,
    knob: 20,
    padding: 2,
  },
  md: {
    trackW: 51,
    trackH: 31,
    knob: 27,
    padding: 2,
  },
  lg: {
    trackW: 58,
    trackH: 35,
    knob: 31,
    padding: 2,
  },
};

/** iOS-like settle for the knob travel. */
const KNOB_SPRING = { type: 'spring', stiffness: 400, damping: 30, mass: 1 } as const;

const DARK_CLASS = 'dark';

const readDarkTheme = (): boolean => {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains(DARK_CLASS);
};

/**
 * True when the Obsidian dark theme is active.
 *
 * Read from `<html class="dark">` (owned by SettingsContext) rather than from the
 * context itself, for the same reason `useReducedMotion` does: this switch also
 * renders outside `SettingsProvider` (onboarding's MobileToggle), where a context
 * read would throw. Observed rather than read once — a one-shot read would freeze
 * at the boot theme and miss every later toggle, which is exactly the staleness
 * bug the reduced-motion check used to have.
 */
const useIsDarkTheme = (): boolean => {
  const [isDark, setIsDark] = useState<boolean>(readDarkTheme);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

    const target = document.documentElement;
    const sync = () => {
      setIsDark(target.classList.contains(DARK_CLASS));
    };
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(target, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
};

// ----------------------------------------------------------------------------
// Dark-mode checked track — a deeper MINT, not a third hue
// ----------------------------------------------------------------------------
// The knob and the track edge are both --fs-ink, which is #f0f0f0 in dark. On the
// resting dark mint (--fs-accent #4ddcbb, L=0.5635) that knob is only 1.50:1 — it
// dissolves into the ON track.
//
// No knob fill can fix it: clearing 3:1 on the OFF track (--fs-surface-2 #262626,
// L=0.0194) needs L>=0.1581, and clearing 3:1 on the bright ON track needs
// L<=0.1545. Empty set. So the ON TRACK is what has to move.
//
// #318d78 is --fs-accent (#4ddcbb) with every channel scaled 0.64 — the method
// tokens.css already uses for --btn-primary-bg-hover (#42bda1 = accent x 0.86):
// identical hue (166.2deg) and saturation, lower value. Still the brand mint, so
// no third accent is introduced.
//
// Its L=0.2106 sits inside the only window that satisfies both sides, [0.1581,
// 0.2571]:
//   knob / border vs ON track   3.54:1  (was 1.50:1)
//   ON track vs OFF track       3.76:1  (state stays legible on fill alone)
// Light mode keeps --fs-accent untouched: there the knob is the dark #132327 and
// already gets 7.67:1, so there is nothing to fix and nothing to regress.
const TRACK_CHECKED_DARK = '#318d78';

/**
 * Track fill for a given state and theme. Exported so the contrast-critical
 * choice is asserted directly — `m.div`'s `animate` never reaches the DOM under
 * jsdom (no motion features are loaded there), so the value cannot be read back
 * off the element in a test.
 */
export const trackBackgroundColor = (checked: boolean, isDark: boolean): string => {
  if (!checked) return 'var(--fs-surface-2)';
  return isDark ? TRACK_CHECKED_DARK : 'var(--fs-accent)';
};

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  id,
  label,
  disabled = false,
  size = 'md',
}) => {
  // Generate unique ID if not provided for accessibility
  const generatedId = useId();
  const switchId = id || generatedId;
  const reducedMotion = useReducedMotion();
  const isDark = useIsDarkTheme();

  const config = sizeConfig[size];
  const travel = config.trackW - config.knob - config.padding * 2;
  // Framer's `x` is a physical translate (ignores `dir`), but the knob is
  // anchored with `insetInlineStart`, so in RTL it must travel the other way.
  const isRTL = typeof document !== 'undefined' && document.dir === 'rtl';
  const knobTravel = isRTL ? -travel : travel;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!disabled) {
        if (!checked) triggerHaptic('light'); // Feedback on activation
        onChange(e.target.checked);
      }
    },
    [disabled, onChange, checked]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        triggerHaptic('light');
        onChange(!checked);
      }
    },
    [disabled, checked, onChange]
  );

  return (
    <label
      htmlFor={switchId}
      className={`
        inline-flex items-center gap-3 select-none touch-target-expand
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group'}
      `}
    >
      <div className="relative" style={{ width: config.trackW, height: config.trackH }}>
        <input
          id={switchId}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          className="sr-only peer"
          checked={checked}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />

        {/* Track — fully rounded, like the system control */}
        <m.div
          className="block peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--fs-accent)] peer-focus-visible:ring-offset-2"
          style={{
            width: config.trackW,
            height: config.trackH,
            borderRadius: 999,
            // --fs-ink, not --fs-primary: --fs-primary does NOT invert
            // (#16292d -> #0a0a0a), so in dark the track edge was 1.31:1 against
            // the OFF fill and 1.05:1 against the card — the control had no
            // visible outline at all. --fs-ink does invert (#132327 -> #f0f0f0):
            // 12.67:1 / 13.28:1 on the OFF fill (light / dark), 16.19:1 / 16.57:1
            // on the card, and 7.67:1 / 3.54:1 on the ON fill.
            //
            // --color-border-strong (the house border token) does NOT work here:
            // in dark it is rgba(255,255,255,0.26), which composites over the OFF
            // fill to #5e5e5e = 2.33:1, and 2.91:1 over the card. Both under the
            // 3:1 that WCAG 1.4.11 asks of a component boundary.
            border: '1px solid var(--fs-ink)',
            // Same value as `animate` below, so mounting does not animate. Framer
            // takes over the property imperatively after mount; having it here too
            // means the track is already the right colour on first paint (and under
            // jsdom, where no motion features are loaded at all).
            backgroundColor: trackBackgroundColor(checked, isDark),
          }}
          animate={{
            backgroundColor: trackBackgroundColor(checked, isDark),
          }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
        />

        {/* Knob — round, travels on transform only */}
        <m.div
          className="absolute"
          style={{
            top: config.padding,
            insetInlineStart: config.padding,
            width: config.knob,
            height: config.knob,
            // The knob is the control's foreground figure, so it must be the
            // dark element on a light theme and the light element on a dark one.
            // --fs-primary never inverts (#16292d → #0a0a0a), which made the knob
            // the DARKEST thing in the track on dark (1.31:1 on --fs-surface-2).
            // --fs-ink is the base foreground token and does invert
            // (#132327 → #f0f0f0), restoring the polarity in both themes.
            // That fixed the knob against the OFF track (13.28:1 dark) but left it
            // at 1.50:1 against the bright ON mint; no single fill can clear both,
            // so the ON track was darkened instead — see TRACK_CHECKED_DARK. The
            // knob now gets 3.54:1 there, on top of the 24px position change.
            backgroundColor: 'var(--fs-ink)',
            borderRadius: 999,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.18), 0 1px 1px rgba(0, 0, 0, 0.1)',
          }}
          animate={{ x: checked ? knobTravel : 0 }}
          transition={reducedMotion ? { duration: 0 } : KNOB_SPRING}
        />
      </div>

      {/* Optional label */}
      {label && (
        <span
          className="transition-colors duration-200"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            letterSpacing: '-0.01em',
            // --fs-ink, not --fs-primary. --fs-primary does not invert, so in dark
            // switching a row ON dropped its own label to 1.05:1 against the card:
            // the label disappeared at the exact moment it became active.
            // --fs-ink / --fs-muted is the real primary/secondary text pair —
            // 16.57:1 ON and 7.49:1 OFF in dark, 16.19:1 / 7.01:1 in light, all
            // clear of the 4.5:1 this 12px/600 text needs.
            color: checked ? 'var(--fs-ink)' : 'var(--fs-muted)',
            fontWeight: 600,
          }}
        >
          {label}
        </span>
      )}
    </label>
  );
};

export default React.memo(ToggleSwitch);
