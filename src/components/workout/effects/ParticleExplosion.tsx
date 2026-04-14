/**
 * ParticleExplosion - Celebration effect for set completion
 * Extracted from ActiveWorkoutNew.tsx for better code organization
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

// Celebration particle colors
const PARTICLE_COLORS = ['#6366f1', '#06b6d4', '#a855f7', '#10b981'];
const PARTICLE_COUNT = 20;

interface Particle {
    x: number;
    y: number;
    scale: number;
    color: string;
    rotation: number;
}

const getRandomColor = (): string => {
    const index = Math.floor(Math.random() * PARTICLE_COLORS.length);
    return PARTICLE_COLORS[index] as string;
};

const ParticleExplosion = React.memo(() => {
    const particles = useMemo<Particle[]>(() =>
        [...Array(PARTICLE_COUNT)].map(() => ({
            x: (Math.random() - 0.5) * 400,
            y: (Math.random() - 0.5) * 400,
            scale: Math.random() * 2,
            color: getRandomColor(),
            // Game Feel: Random rotation for chaotic energy
            rotation: (Math.random() - 0.5) * 720,
        })), []
    );

    return (
        <div
            className="fixed inset-0 pointer-events-none z-[99999] flex items-center justify-center overflow-hidden"
            role="presentation"
            aria-hidden="true"
        >
            {particles.map((particle, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 1, x: 0, y: 0, scale: 0, rotate: 0 }}
                    animate={{
                        opacity: 0,
                        x: particle.x,
                        y: particle.y,
                        scale: particle.scale,
                        rotate: particle.rotation,
                    }}
                    // Game Feel: Spring physics for "pop" effect instead of linear easeOut
                    transition={{
                        type: "spring",
                        stiffness: 100,
                        damping: 15,
                        duration: 1.5
                    }}
                    className="absolute w-2 h-2 rounded-full"
                    style={{ background: particle.color }}
                />
            ))}
        </div>
    );
});

ParticleExplosion.displayName = 'ParticleExplosion';

export default ParticleExplosion;
