import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface Premium3DCardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    depth?: number; // Intensity of the 3D effect
    glareColor?: string;
}

export const Premium3DCard: React.FC<Premium3DCardProps> = ({
    children,
    className = '',
    onClick,
    depth = 15, // Degrees of tilt
    glareColor = 'rgba(255, 255, 255, 0.4)'
}) => {
    const ref = useRef<HTMLDivElement>(null);
    const [isHovered, setIsHovered] = useState(false);

    // Mouse position state
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    // Smooth physics for tilt
    const mouseX = useSpring(x, { stiffness: 300, damping: 30 });
    const mouseY = useSpring(y, { stiffness: 300, damping: 30 });

    // Transform mouse position to rotation values
    const rotateX = useTransform(mouseY, [-0.5, 0.5], [depth, -depth]);
    const rotateY = useTransform(mouseX, [-0.5, 0.5], [-depth, depth]);

    // Parallax effect for inner content (if needed, children can use this context)
    // For now, we apply subtle scale/lift
    const scale = useSpring(isHovered ? 1.05 : 1, { stiffness: 400, damping: 30 });
    const lift = useSpring(isHovered ? -10 : 0, { stiffness: 400, damping: 30 });

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!ref.current) return;

        const rect = ref.current.getBoundingClientRect();

        // Calculate normalized position (-0.5 to 0.5)
        const width = rect.width;
        const height = rect.height;
        const mouseXPos = e.clientX - rect.left;
        const mouseYPos = e.clientY - rect.top;

        const xPct = (mouseXPos / width) - 0.5;
        const yPct = (mouseYPos / height) - 0.5;

        x.set(xPct);
        y.set(yPct);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
        x.set(0);
        y.set(0);
    };

    const handleMouseEnter = () => {
        setIsHovered(true);
    };

    return (
        <motion.div
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={onClick}
            style={{
                perspective: 1200,
                transformStyle: "preserve-3d",
                y: lift,
                scale: scale
            }}
            className={`relative cursor-pointer ${className}`}
            whileTap={{ scale: 0.95 }}
        >
            <motion.div
                style={{
                    rotateX,
                    rotateY,
                    transformStyle: "preserve-3d",
                }}
                className="relative w-full h-full"
            >
                {/* Content */}
                <div
                    className="relative z-10 w-full h-full"
                    style={{ transform: "translateZ(20px)" }} // Push content forward for depth
                >
                    {children}
                </div>

                {/* Card Background / Glass Layer */}
                <div
                    className="absolute inset-0 rounded-3xl bg-white/[0.03] border border-white/[0.05] backdrop-blur-xl shadow-xl transition-colors duration-500"
                    style={{ transform: "translateZ(0px)" }}
                />

                {/* Specular Glare Effect */}
                <motion.div
                    className="absolute inset-0 rounded-3xl pointer-events-none"
                    style={{
                        background: `radial-gradient(
                            circle at ${50 + x.get() * 100}% ${50 + y.get() * 100}%, 
                            ${glareColor}, 
                            transparent 80%
                        )`,
                        transform: "translateZ(1px)", // Sit slightly above background
                        opacity: isHovered ? 1 : 0,
                        transition: 'opacity 0.2s ease-out'
                    }}
                />
            </motion.div>
        </motion.div>
    );
};
