import React from 'react';
import { motion } from 'framer-motion';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
    label,
    error,
    icon,
    className = '',
    id,
    ...props
}) => {
    const inputId = id || props.name || Math.random().toString(36).substring(2, 11);

    return (
        <div className={`flex flex-col gap-2 ${className}`}>
            {label && (
                <label
                    htmlFor={inputId}
                    className="text-[11px] font-semibold text-white/50 uppercase tracking-wider ml-1"
                >
                    {label}
                </label>
            )}
            <div className="relative group">
                <input
                    id={inputId}
                    className={`
                        w-full
                        bg-white/5 
                        border border-white/10 
                        rounded-2xl 
                        px-5 py-4 
                        text-base text-white placeholder-white/30 
                        transition-all duration-300 ease-out
                        focus:outline-none 
                        focus:bg-white/8 
                        focus:border-white/20 
                        focus:ring-4 focus:ring-white/5
                        hover:border-white/15 hover:bg-white/[0.06]
                        ${icon ? 'pl-12' : ''}
                        ${error ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/10' : ''}
                    `}
                    {...props}
                />
                {icon && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-white/60 transition-colors duration-300">
                        {icon}
                    </div>
                )}
            </div>
            {error && (
                <motion.span
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs text-red-400 ml-1 font-medium"
                >
                    {error}
                </motion.span>
            )}
        </div>
    );
};
