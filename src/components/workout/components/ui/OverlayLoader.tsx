// OverlayLoader - Premium Suspense fallback for lazy-loaded overlays
// Pulsing dots animation with dark overlay background

import { memo } from 'react';
import { motion } from 'framer-motion';

const DOT_TRANSITION = {
    duration: 0.6,
    repeat: Infinity,
    repeatType: 'reverse' as const,
};

const OverlayLoader = memo(() => (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center">
        <div className="flex items-center gap-2">
            {[0, 1, 2].map(i => (
                <motion.div
                    key={i}
                    className="w-2.5 h-2.5 rounded-full bg-[var(--cosmos-accent-primary)]"
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
                    transition={{ ...DOT_TRANSITION, delay: i * 0.15 }}
                />
            ))}
        </div>
    </div>
));

OverlayLoader.displayName = 'OverlayLoader';

export default OverlayLoader;
