import React, { memo } from 'react';
import { motion } from 'framer-motion';

// ============================================================
// COMPONENT
// ============================================================

export interface BadgeProps {
    children: React.ReactNode;
    variant?: 'default' | 'success' | 'accent' | 'gold' | 'purple' | 'gradient';
    animate?: boolean;
    icon?: React.ReactNode;
}

export const Badge = memo<BadgeProps>(({ children, variant = 'default', animate = false, icon }) => {
    const variants = {
        default: 'bg-[var(--bg-elevated)] text-white/80 border-white/5',
        success: 'bg-[#30D158]/15 text-[#30D158] border-[#30D158]/20',
        accent: 'bg-[var(--cosmos-accent-primary)]/10 text-[var(--cosmos-accent-primary)] border-[var(--cosmos-accent-primary)]/20',
        gold: 'bg-[#FFD60A]/10 text-[#FFD60A] border-[#FFD60A]/20',
        purple: 'bg-[#BF5AF2]/10 text-[#BF5AF2] border-[#BF5AF2]/20',
        gradient: 'bg-gradient-to-r from-[#667eea]/20 to-[#764ba2]/20 text-white border-white/20',
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 
                rounded-xl border font-semibold text-xs
                ${variants[variant]}
                ${animate ? 'workout-pulse-glow' : ''}
            `}
        >
            {icon}
            {children}
        </motion.div>
    );
});

Badge.displayName = 'Badge';
