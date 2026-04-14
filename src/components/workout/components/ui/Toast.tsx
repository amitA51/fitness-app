// Toast — Inline notification replacing native alert()
// Features: Auto-dismiss, slide-in animation, success/error/info variants

import { useState, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type ToastVariant = 'success' | 'error' | 'info';

interface ToastMessage {
    id: number;
    text: string;
    variant: ToastVariant;
}

const VARIANT_STYLES: Record<ToastVariant, { bg: string; icon: string; border: string }> = {
    success: {
        bg: 'bg-emerald-500/15',
        icon: '✅',
        border: 'border-emerald-500/30',
    },
    error: {
        bg: 'bg-red-500/15',
        icon: '❌',
        border: 'border-red-500/30',
    },
    info: {
        bg: 'bg-blue-500/15',
        icon: 'ℹ️',
        border: 'border-blue-500/30',
    },
};

let toastId = 0;

// Singleton state — allows imperative usage from anywhere
let globalSetToasts: React.Dispatch<React.SetStateAction<ToastMessage[]>> | null = null;

export function showToast(text: string, variant: ToastVariant = 'success') {
    if (!globalSetToasts) return;
    const id = ++toastId;
    globalSetToasts(prev => [...prev.slice(-2), { id, text, variant }]);
}

const ToastItem = memo<{ toast: ToastMessage; onDismiss: (id: number) => void }>(
    ({ toast, onDismiss }) => {
        const style = VARIANT_STYLES[toast.variant];

        useEffect(() => {
            const timer = setTimeout(() => onDismiss(toast.id), 3000);
            return () => clearTimeout(timer);
        }, [toast.id, onDismiss]);

        return (
            <motion.div
                layout
                initial={{ opacity: 0, y: -40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className={`
                    flex items-center gap-2.5 px-4 py-3 rounded-2xl
                    backdrop-blur-xl border shadow-lg
                    ${style.bg} ${style.border}
                    text-sm font-semibold text-white
                `}
            >
                <span className="text-base">{style.icon}</span>
                <span className="flex-1">{toast.text}</span>
                <button
                    onClick={() => onDismiss(toast.id)}
                    className="text-white/40 hover:text-white/70 transition-colors text-xs font-bold"
                >
                    ✕
                </button>
            </motion.div>
        );
    }
);

ToastItem.displayName = 'ToastItem';

/** Mount once at the top of your workout tree */
export const ToastContainer = memo(() => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    useEffect(() => {
        globalSetToasts = setToasts;
        return () => { globalSetToasts = null; };
    }, []);

    const dismiss = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <div className="fixed top-4 inset-x-4 z-[15000] flex flex-col items-center gap-2 pointer-events-none">
            <AnimatePresence>
                {toasts.map(t => (
                    <div key={t.id} className="pointer-events-auto w-full max-w-sm">
                        <ToastItem toast={t} onDismiss={dismiss} />
                    </div>
                ))}
            </AnimatePresence>
        </div>
    );
});

ToastContainer.displayName = 'ToastContainer';
