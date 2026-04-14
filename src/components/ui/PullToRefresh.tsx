import React from 'react';
import { motion } from 'framer-motion';
import { usePullToRefresh } from '../../hooks/usePullToRefresh';

interface PullToRefreshProps {
    onRefresh: () => Promise<void>;
    children?: React.ReactNode;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
    const { pullDistance, isRefreshing, threshold } = usePullToRefresh({
        onRefresh,
    });

    // Calculate rotation based on pull distance
    const rotation = Math.min((pullDistance / threshold) * 360, 360);
    const opacity = Math.min(pullDistance / (threshold * 0.5), 1);
    const scale = Math.min(pullDistance / (threshold * 0.8), 1);

    return (
        <>
            {pullDistance > 0 || isRefreshing ? (
                <div
                    className="fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
                    style={{ top: 'calc(env(safe-area-inset-top) + 10px)' }}
                >
                    <div
                        className="relative flex items-center justify-center rounded-full surface-secondary shadow-2xl border border-white/10"
                        style={{
                            width: 40,
                            height: 40,
                            transform: `translateY(${pullDistance * 0.5}px) scale(${isRefreshing ? 1 : scale})`,
                            opacity: isRefreshing ? 1 : opacity,
                            transition: isRefreshing ? 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none', // Smooth snap
                        }}
                    >
                        {isRefreshing ? (
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="w-5 h-5 border-2 border-[var(--dynamic-accent-start)] border-t-transparent rounded-full"
                            />
                        ) : (
                            <div
                                className="w-5 h-5 text-[var(--dynamic-accent-start)]"
                                style={{
                                    transform: `rotate(${rotation}deg)`,
                                    transition: 'transform 0.1s linear'
                                }}
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M23 4v6h-6" />
                                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                </svg>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}
            {children}
        </>
    );
};
