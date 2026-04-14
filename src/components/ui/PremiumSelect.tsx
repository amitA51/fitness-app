import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

    const selectedOption = options.find((opt) => opt.value === value);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {label && (
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-2">
                    {label}
                </label>
            )}

            <motion.button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl 
          bg-[var(--surface-base)] border border-[var(--border-subtle)] 
          text-left text-[var(--text-primary)] transition-all duration-300
          hover:bg-[var(--surface-hover)] focus:outline-none 
          ${isOpen ? 'border-[var(--dynamic-accent-start)] ring-1 ring-[var(--dynamic-accent-start)]' : ''}
        `}
                whileTap={{ scale: 0.98 }}
            >
                <span className={`block truncate ${!selectedOption ? 'text-[var(--text-muted)]' : ''}`}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                    <motion.div
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-[var(--text-secondary)]">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                        </svg>
                    </motion.div>
                </span>
            </motion.button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute z-50 mt-2 w-full max-h-60 overflow-auto rounded-xl 
              bg-[var(--bg-primary)]/95 backdrop-blur-xl border border-[var(--border-subtle)] 
              shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none
              custom-scrollbar"
                        style={{
                            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.5)'
                        }}
                    >
                        <div className="p-1">
                            {options.map((option) => (
                                <motion.button
                                    key={option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={`
                    relative w-full cursor-pointer select-none py-2.5 pl-3 pr-9 rounded-lg text-left
                    transition-colors duration-200
                    ${value === option.value
                                            ? 'bg-[var(--dynamic-accent-start)]/10 text-[var(--dynamic-accent-start)]'
                                            : 'text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
                                        }
                    `}
                                    whileHover={{ x: 4 }}
                                >
                                    <span className={`block truncate ${value === option.value ? 'font-medium' : 'font-normal'}`}>
                                        {option.label}
                                    </span>

                                    {value === option.value && (
                                        <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--dynamic-accent-start)]">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                                <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                            </svg>
                                        </span>
                                    )}
                                </motion.button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
