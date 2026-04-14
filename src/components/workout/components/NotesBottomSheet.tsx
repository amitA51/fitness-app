// NotesBottomSheet - Premium text-area bottom sheet for set notes
// Replaces native prompt() with a polished note-taking interface
// Uses Portal rendering via ModalOverlay for proper z-index stacking and focus management

import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ModalOverlay } from '../../ui/ModalOverlay';

interface NotesBottomSheetProps {
    isOpen: boolean;
    currentNotes: string;
    exerciseName: string;
    setIndex: number;
    onSave: (notes: string) => void;
    onClose: () => void;
}

const QUICK_NOTES = [
    'כאב קל',
    'הרגשה מצוינת',
    'משקל קל מדי',
    'משקל כבד מדי',
    'טכניקה לא טובה',
    'Drop Set',
    'פאוז בתחתית',
    'שליטה מלאה',
];

const NotesBottomSheet = memo<NotesBottomSheetProps>(({ isOpen, currentNotes, exerciseName, setIndex, onSave, onClose }) => {
    const [text, setText] = useState(currentNotes);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen) {
            setText(currentNotes);
            setTimeout(() => textAreaRef.current?.focus(), 300);
        }
    }, [isOpen, currentNotes]);

    const handleSave = useCallback(() => {
        onSave(text.trim());
        onClose();
    }, [text, onSave, onClose]);

    const handleQuickNote = useCallback((note: string) => {
        setText(prev => {
            const separator = prev.trim() ? ', ' : '';
            return prev + separator + note;
        });
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate([5]);
        }
    }, []);

    return (
        <ModalOverlay
            isOpen={isOpen}
            onClose={onClose}
            variant="none"
            zLevel="high"
            backdropOpacity={70}
            blur="sm"
            trapFocus
            lockScroll
            closeOnBackdropClick
            closeOnEscape
            ariaLabel={`הערה לסט ${setIndex + 1} - ${exerciseName}`}
        >
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 bg-[var(--bg-secondary)] rounded-t-3xl border-t border-white/10 pb-safe"
                onClick={e => e.stopPropagation()}
            >
                {/* Handle */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>

                {/* Header */}
                <div className="px-6 pb-3 text-center">
                    <h3 className="text-xl font-bold text-white mb-0.5">הערה לסט</h3>
                    <p className="text-xs text-white/40">{exerciseName} • סט {setIndex + 1}</p>
                </div>

                {/* Quick Notes */}
                <div className="px-4 pb-3">
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 custom-scrollbar">
                        {QUICK_NOTES.map(note => (
                            <motion.button
                                key={note}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleQuickNote(note)}
                                className="flex-shrink-0 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/60 font-medium hover:bg-white/10 hover:text-white/80 transition-all"
                            >
                                {note}
                            </motion.button>
                        ))}
                    </div>
                </div>

                {/* Text Area */}
                <div className="px-6 pb-4">
                    <textarea
                        ref={textAreaRef}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="כתוב הערה..."
                        rows={3}
                        className="
                            w-full px-4 py-3 rounded-2xl
                            bg-black/30 border border-white/10
                            text-white text-sm placeholder-white/30
                            outline-none resize-none
                            focus:border-[#BF5AF2]/50 focus:shadow-[0_0_15px_rgba(191,90,242,0.15)]
                            transition-all
                        "
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSave();
                            }
                        }}
                    />
                    <div className="flex justify-between mt-1.5 px-1">
                        <span className="text-[10px] text-white/20">{text.length} תווים</span>
                        <span className="text-[10px] text-white/20">Enter לשמירה</span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 px-6 pb-8">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-white/70 font-semibold text-sm"
                    >
                        ביטול
                    </button>
                    {text.trim() && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            onClick={() => { onSave(''); onClose(); }}
                            className="py-3.5 px-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-semibold text-sm"
                        >
                            נקה
                        </motion.button>
                    )}
                    <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={handleSave}
                        className="flex-1 py-3.5 rounded-2xl bg-[var(--cosmos-pink)] font-bold text-sm text-white shadow-lg shadow-[var(--cosmos-pink)]/20"
                    >
                        שמור
                    </motion.button>
                </div>
            </motion.div>
        </ModalOverlay>
    );
});

NotesBottomSheet.displayName = 'NotesBottomSheet';

export default NotesBottomSheet;
