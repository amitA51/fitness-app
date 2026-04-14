import React, { useId, useCallback } from 'react';
import { motion } from 'framer-motion';
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

const sizeConfig = {
  sm: {
    track: 'w-9 h-5',
    thumb: 'w-3.5 h-3.5',
    thumbOn: 'calc(100% - 1.125rem)',
    thumbOff: '0.1875rem',
    top: 'top-[3px]',
  },
  md: {
    track: 'w-12 h-7',
    thumb: 'w-5 h-5',
    thumbOn: 'calc(100% - 1.5rem)',
    thumbOff: '0.25rem',
    top: 'top-1',
  },
  lg: {
    track: 'w-14 h-8',
    thumb: 'w-6 h-6',
    thumbOn: 'calc(100% - 1.75rem)',
    thumbOff: '0.25rem',
    top: 'top-1',
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

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!disabled) {
      if (!checked) triggerHaptic('light'); // Feedback on activation
      onChange(e.target.checked);
    }
  }, [disabled, onChange, checked]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      triggerHaptic('light');
      onChange(!checked);
    }
  }, [disabled, checked, onChange]);

  return (
    <label
      htmlFor={switchId}
      className={`
        inline-flex items-center gap-3 select-none touch-target-expand
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer group'}
      `}
    >
      <div className="relative">
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

        {/* Track */}
        <motion.div
          className={`
            block ${config.track} rounded-full 
            transition-colors duration-200 ease-out
            border border-transparent 
            ${!disabled && 'group-hover:border-white/10'}
            focus-within:ring-2 focus-within:ring-[var(--dynamic-accent-start)]/50 focus-within:ring-offset-2 focus-within:ring-offset-[var(--bg-primary)]
          `}
          animate={{
            backgroundColor: checked
              ? 'var(--dynamic-accent-start)'
              : 'var(--gray-200, rgba(120, 120, 128, 0.2))',
            boxShadow: checked
              ? '0 0 12px var(--dynamic-accent-glow), inset 0 1px 1px rgba(255,255,255,0.1)'
              : 'inset 0 1px 3px rgba(0,0,0,0.15)',
          }}
          transition={{ duration: 0.2 }}
        />

        {/* Thumb */}
        <motion.div
          className={`
            absolute ${config.top} ${config.thumb} 
            bg-white rounded-full shadow-lg
            flex items-center justify-center
          `}
          animate={{
            left: checked ? config.thumbOn : config.thumbOff,
            scale: checked ? 1 : 0.9,
          }}
          transition={{
            type: 'spring',
            stiffness: 500,
            damping: 30,
          }}
          whileTap={{ scale: 0.85 }}
        >
          {/* Inner shine effect */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%)',
            }}
          />
        </motion.div>
      </div>

      {/* Optional label */}
      {label && (
        <span className={`
          text-sm font-medium transition-colors duration-200
          ${checked ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}
        `}>
          {label}
        </span>
      )}
    </label>
  );
};

export default React.memo(ToggleSwitch);
