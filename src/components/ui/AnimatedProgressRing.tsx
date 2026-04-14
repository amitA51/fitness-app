import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnimatedProgressRingProps {
    percentage: number;
    size?: number;
    strokeWidth?: number;
    showConfetti?: boolean;
    label?: string;
    subLabel?: string;
}

// Confetti particle component
const ConfettiParticle: React.FC<{ delay: number; color: string | undefined }> = ({ delay, color }) => {
    const randomX = (Math.random() - 0.5) * 100;
    const randomRotation = Math.random() * 720;

    return (
        <motion.div
            className="absolute w-2 h-2 rounded-sm"
            style={{
                backgroundColor: color,
                left: '50%',
                top: '50%',
            }}
            initial={{
                x: 0,
                y: 0,
                scale: 0,
                rotate: 0,
                opacity: 1
            }}
            animate={{
                x: randomX,
                y: -80 - Math.random() * 40,
                scale: [0, 1, 0],
                rotate: randomRotation,
                opacity: [1, 1, 0]
            }}
            transition={{
                duration: 1.2,
                delay: delay,
                ease: [0.22, 1, 0.36, 1]
            }}
        />
    );
};

const AnimatedProgressRing: React.FC<AnimatedProgressRingProps> = ({
    percentage,
    size = 140,
    strokeWidth = 12,
    showConfetti = true,
    label,
    subLabel,
}) => {
    const [showCelebration, setShowCelebration] = useState(false);
    const [prevPercentage, setPrevPercentage] = useState(percentage);

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    // Detect when we reach 100%
    useEffect(() => {
        if (percentage >= 100 && prevPercentage < 100 && showConfetti) {
            setShowCelebration(true);
            const timer = setTimeout(() => setShowCelebration(false), 2000);
            return () => clearTimeout(timer);
        }
        setPrevPercentage(percentage);
        return undefined;
    }, [percentage, prevPercentage, showConfetti]);

    // Confetti colors - defined outside useMemo to avoid recreation
    const confettiColors = useMemo(() => [
        '#00F0FF', // cyan
        '#7B61FF', // violet
        '#FF006E', // magenta
        '#FFB800', // gold
        '#10B981', // emerald
        '#F43F5E', // rose
    ], []);

    const confettiParticles = useMemo(() => {
        return Array.from({ length: 20 }).map((_, i) => ({
            id: i,
            color: confettiColors[i % confettiColors.length],
            delay: i * 0.03,
        }));
    }, [confettiColors]);

    // Gradient colors based on percentage
    const getGradientColors = useCallback(() => {
        if (percentage >= 100) {
            return { start: '#10B981', end: '#34D399' }; // Green
        }
        if (percentage >= 75) {
            return { start: '#00F0FF', end: '#7B61FF' }; // Cyan to Violet
        }
        if (percentage >= 50) {
            return { start: '#7B61FF', end: '#C77DFF' }; // Violet shades
        }
        if (percentage >= 25) {
            return { start: '#F97316', end: '#FBBF24' }; // Orange to Yellow
        }
        return { start: '#6B7280', end: '#9CA3AF' }; // Gray
    }, [percentage]);

    const gradientColors = getGradientColors();
    const gradientId = `progress-gradient-${size}`;

    return (
        <div
            className={`relative inline-flex items-center justify-center celebration-container ${percentage >= 100 ? 'progress-ring-complete' : ''
                }`}
            style={{ width: size, height: size }}
        >
            {/* Confetti */}
            <AnimatePresence>
                {showCelebration && (
                    <div className="absolute inset-0 pointer-events-none overflow-visible">
                        {confettiParticles.map(particle => (
                            <ConfettiParticle
                                key={particle.id}
                                delay={particle.delay}
                                color={particle.color}
                            />
                        ))}
                    </div>
                )}
            </AnimatePresence>

            {/* Background glow */}
            <motion.div
                className="absolute rounded-full"
                style={{
                    width: size,
                    height: size,
                    background: `radial-gradient(circle, ${gradientColors.start}20 0%, transparent 70%)`,
                }}
                animate={{
                    scale: percentage >= 100 ? [1, 1.1, 1] : 1,
                    opacity: percentage >= 100 ? [0.5, 1, 0.5] : 0.5,
                }}
                transition={{
                    duration: 2,
                    repeat: percentage >= 100 ? Infinity : 0,
                    ease: 'easeInOut',
                }}
            />

            {/* SVG Ring */}
            <svg
                className="progress-ring-container -rotate-90"
                width={size}
                height={size}
            >
                <defs>
                    <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={gradientColors.start} />
                        <stop offset="100%" stopColor={gradientColors.end} />
                    </linearGradient>

                    {/* Glow filter */}
                    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Background track */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeWidth={strokeWidth}
                />

                {/* Progress arc */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={`url(#${gradientId})`}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{
                        duration: 1,
                        ease: [0.22, 1, 0.36, 1]
                    }}
                    filter="url(#glow)"
                />
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                    key={Math.round(percentage)}
                    initial={{ scale: 1.2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`font-bold text-white font-heading ${size < 50 ? 'text-[10px]' : size < 100 ? 'text-xl' : 'text-3xl'}`}
                >
                    {Math.round(percentage)}%
                </motion.span>

                {label && (
                    <span className="text-xs text-theme-secondary mt-0.5">{label}</span>
                )}

                {subLabel && (
                    <span className="text-[10px] text-theme-muted">{subLabel}</span>
                )}

                {/* Completion badge */}
                <AnimatePresence>
                    {percentage >= 100 && (
                        <motion.div
                            initial={{ scale: 0, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0, y: 10 }}
                            className="absolute -bottom-2"
                        >
                            <span className="text-2xl">🎉</span>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default AnimatedProgressRing;
