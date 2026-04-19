import { motion } from 'framer-motion';
import React, { useId, useCallback } from 'react';
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

// Sport Annual toggles — sharp rectangles, navy knob, mustard active track
const sizeConfig = {
  sm: {
    trackW: 32,
    trackH: 18,
    knob: 14,
    padding: 2,
  },
  md: {
    trackW: 40,
    trackH: 24,
    knob: 20,
    padding: 2,
  },
  lg: {
    trackW: 48,
    trackH: 28,
    knob: 22,
    padding: 3,
  },
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

  const config = sizeConfig[size];
  const travel = config.trackW - config.knob - config.padding * 2;

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
      <div
        className="relative"
        style={{ width: config.trackW, height: config.trackH }}
      >
        <input
          id={switchId}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          className="sr-only"
          checked={checked}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />

        {/* Track — sharp rect, 1px navy border */}
        <motion.div
          className="block focus-within:ring-2 focus-within:ring-[var(--mustard)]"
          style={{
            width: config.trackW,
            height: config.trackH,
            borderRadius: 2,
            border: '1px solid var(--navy)',
          }}
          animate={{
            backgroundColor: checked ? 'var(--mustard)' : 'var(--bone-deep)',
          }}
          transition={{ duration: 0.2 }}
        />

        {/* Knob — navy sharp square */}
        <motion.div
          className="absolute"
          style={{
            top: config.padding,
            width: config.knob,
            height: config.knob,
            backgroundColor: 'var(--navy)',
            borderRadius: 2,
          }}
          animate={{
            left: checked ? travel + config.padding : config.padding,
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
          }}
          whileTap={{ scale: 0.9 }}
        />
      </div>

      {/* Optional label */}
      {label && (
        <span
          className="transition-colors duration-200"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: checked ? 'var(--navy)' : 'var(--stone)',
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
