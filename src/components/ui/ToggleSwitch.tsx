import { m } from 'framer-motion';
import React, { useCallback, useId } from 'react';
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
            border: '1px solid var(--fs-primary)',
          }}
          animate={{
            backgroundColor: checked ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
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
            backgroundColor: 'var(--fs-primary)',
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
            color: checked ? 'var(--fs-primary)' : 'var(--fs-muted)',
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
