import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

interface Option {
  value: string;
  label: string;
}

interface PremiumSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export const PremiumSelect: React.FC<PremiumSelectProps> = ({
  options,
  value,
  onChange,
  label,
  placeholder = 'Select an option',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const labelId = useId();
  const buttonId = useId();

  const selectedOption = options.find((opt) => opt.value === value);

  // Close on click/touch outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      const currentIndex = options.findIndex((opt) => opt.value === value);
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
        case 'ArrowDown': {
          e.preventDefault();
          const nextIndex = Math.min(currentIndex + 1, options.length - 1);
          const nextOption = options[nextIndex];
          if (nextOption) onChange(nextOption.value);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prevIndex = Math.max(currentIndex - 1, 0);
          const prevOption = options[prevIndex];
          if (prevOption) onChange(prevOption.value);
          break;
        }
        case 'Enter':
        case ' ':
          e.preventDefault();
          setIsOpen(false);
          break;
      }
    },
    [isOpen, options, value, onChange]
  );

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label
          id={labelId}
          htmlFor={buttonId}
          className="block uppercase mb-2"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            letterSpacing: '0.22em',
            color: 'var(--fs-muted)',
            fontWeight: 600,
          }}
        >
          {label}
        </label>
      )}

      <motion.button
        id={buttonId}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-labelledby={label ? labelId : undefined}
        className="w-full flex items-center justify-between px-4 text-left transition-colors duration-150"
        style={{
          minHeight: 48,
          backgroundColor: 'var(--fs-surface)',
          border: isOpen ? '2px solid var(--fs-primary)' : '1px solid var(--fs-surface-2)',
          borderRadius: 0,
          color: 'var(--fs-ink)',
          fontFamily: 'var(--font-body)',
          fontSize: '15px',
        }}
        whileTap={{ scale: 0.995 }}
      >
        <span
          className="block truncate"
          style={{
            color: selectedOption ? 'var(--fs-ink)' : 'var(--fs-muted)',
          }}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-4">
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4"
              style={{ color: 'var(--fs-heading)' }}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </motion.div>
        </span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            id={listboxId}
            role="listbox"
            aria-labelledby={label ? labelId : undefined}
            className="absolute z-50 mt-1 w-full max-h-60 overflow-auto focus:outline-none custom-scrollbar"
            style={{
              backgroundColor: 'var(--fs-bg)',
              border: '2px solid var(--fs-primary)',
              borderRadius: 0,
              boxShadow: 'var(--shadow-card)',
            }}
          >
            {options.map((option) => {
              const isSelected = value === option.value;
              return (
                <motion.button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  role="option"
                  aria-selected={isSelected}
                  className="relative w-full cursor-pointer select-none py-2.5 pl-4 pr-9 text-left transition-colors duration-150"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    letterSpacing: '0.04em',
                    color: isSelected ? 'var(--fs-primary)' : 'var(--fs-ink)',
                    backgroundColor: isSelected ? 'var(--fs-surface-2)' : 'transparent',
                    fontWeight: isSelected ? 600 : 400,
                    borderRadius: 0,
                  }}
                  whileHover={{
                    backgroundColor: 'var(--fs-surface-2)',
                  }}
                >
                  <span className="block truncate">{option.label}</span>

                  {isSelected && (
                    <span
                      className="absolute inset-y-0 right-0 flex items-center pr-3"
                      style={{ color: 'var(--fs-accent)' }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-5 h-5"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                  )}
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
