/**
 * LongPressMenu - Premium Contextual Action Menu
 *
 * A rich, haptic-enabled context menu that appears on long-press.
 * Follows Apple's "peek and pop" design philosophy with spring animations.
 */

import { AnimatePresence, m } from 'framer-motion';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHaptics } from '../../hooks/useHaptics';
import { MOTION_CURVES } from '../animations/presets';

export interface MenuAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  /** Red text for destructive actions */
  isDestructive?: boolean;
  /** Gray out if disabled */
  isDisabled?: boolean;
}

interface LongPressMenuProps {
  children: React.ReactNode;
  actions: MenuAction[];
  /** Delay before long-press triggers (ms) */
  delay?: number;
  /** Whether long-press is enabled */
  enabled?: boolean;
  /** Callback when menu opens */
  onOpen?: () => void;
  /** Callback when menu closes */
  onClose?: () => void;
  /** Additional class for the wrapper */
  className?: string;
  /** Accessible label for the trigger element */
  ariaLabel?: string;
}

/**
 * Wrap any element to enable long-press context menu.
 *
 * @example
 * <LongPressMenu
 *   actions={[
 *     { id: 'complete', label: 'סמן כהושלם', icon: <CheckIcon />, onClick: handleComplete },
 *     { id: 'delete', label: 'מחק', icon: <TrashIcon />, onClick: handleDelete, isDestructive: true },
 *   ]}
 * >
 *   <TaskCard {...props} />
 * </LongPressMenu>
 */
export const LongPressMenu: React.FC<LongPressMenuProps> = ({
  children,
  actions,
  delay = 500,
  enabled = true,
  onOpen,
  onClose,
  className = '',
  ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [isPressed, setIsPressed] = useState(false);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const didLongPress = useRef(false);
  const pressStartPos = useRef<{ x: number; y: number } | null>(null);

  const { triggerHaptic, hapticSuccess } = useHaptics();

  const calculateMenuPosition = useCallback(
    (clientX: number, clientY: number) => {
      const menuWidth = 200;
      const menuHeight = actions.length * 48 + 16; // Approximate menu height
      const padding = 16;

      let x = clientX - menuWidth / 2;
      let y = clientY - 20;

      // Keep within viewport bounds
      x = Math.max(padding, Math.min(x, window.innerWidth - menuWidth - padding));
      y = Math.max(padding, Math.min(y, window.innerHeight - menuHeight - padding));

      return { x, y };
    },
    [actions.length]
  );

  const openMenu = useCallback(
    (clientX: number, clientY: number) => {
      didLongPress.current = true;
      triggerHaptic('medium');
      setMenuPosition(calculateMenuPosition(clientX, clientY));
      setIsOpen(true);
      setIsPressed(false);
      onOpen?.();
    },
    [calculateMenuPosition, triggerHaptic, onOpen]
  );

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  const handleAction = useCallback(
    (action: MenuAction) => {
      if (action.isDisabled) return;
      hapticSuccess();
      closeMenu();
      // Delay action slightly to let menu animate out
      setTimeout(() => {
        action.onClick();
      }, 100);
    },
    [hapticSuccess, closeMenu]
  );

  // Touch handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;

      const touch = e.touches[0];
      if (!touch) return;

      didLongPress.current = false;
      setIsPressed(true);
      pressStartPos.current = { x: touch.clientX, y: touch.clientY };

      longPressTimer.current = setTimeout(() => {
        openMenu(touch.clientX, touch.clientY);
      }, delay);
    },
    [enabled, delay, openMenu]
  );

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pressStartPos.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - pressStartPos.current.x);
    const dy = Math.abs(touch.clientY - pressStartPos.current.y);
    if (dx > 10 || dy > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      setIsPressed(false);
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsPressed(false);

    // Prevent click if long press happened
    if (didLongPress.current) {
      e.preventDefault();
    }
  }, []);

  // Mouse handlers (for desktop)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!enabled || e.button !== 0) return;

      didLongPress.current = false;
      setIsPressed(true);
      pressStartPos.current = { x: e.clientX, y: e.clientY };

      longPressTimer.current = setTimeout(() => {
        openMenu(e.clientX, e.clientY);
      }, delay);
    },
    [enabled, delay, openMenu]
  );

  const handleMouseUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsPressed(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setIsPressed(false);
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = () => {
      closeMenu();
    };

    // Use setTimeout to avoid immediate close on the same touch event
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, closeMenu]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeMenu]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={elementRef}
        className={`${className} ${isPressed ? 'scale-[0.98]' : ''} transition-transform duration-150`}
        role="button"
        aria-haspopup="menu"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={(e) => {
          if (!enabled) return;
          if (
            e.key === 'Enter' ||
            e.key === ' ' ||
            e.key === 'ContextMenu' ||
            (e.shiftKey && e.key === 'F10')
          ) {
            e.preventDefault();
            const rect = elementRef.current?.getBoundingClientRect();
            if (rect) openMenu(rect.left + rect.width / 2, rect.top + rect.height / 2);
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: 'pan-y' }}
      >
        {children}
      </div>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <>
              {/* Backdrop */}
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                onClick={closeMenu}
              />

              {/* Menu */}
              <m.div
                className="fixed z-50 min-w-[180px] rounded-2xl overflow-hidden"
                initial={{ opacity: 0, scale: 0.85, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -5 }}
                transition={MOTION_CURVES.settle}
                role="menu"
                aria-label="תפריט פעולות"
                style={{
                  left: menuPosition.x,
                  top: menuPosition.y,
                  background: 'color-mix(in srgb, var(--fs-surface) 95%, transparent)',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  border: '1px solid var(--color-border)',
                  boxShadow:
                    '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--fs-surface-shine-subtle) inset',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <m.div
                  className="py-2"
                  variants={{
                    hidden: {},
                    visible: {
                      transition: {
                        staggerChildren: 0.03,
                      },
                    },
                  }}
                  initial="hidden"
                  animate="visible"
                >
                  {actions.map((action, index) => (
                    <m.button
                      key={action.id}
                      variants={{
                        hidden: { opacity: 0, x: -10 },
                        visible: { opacity: 1, x: 0 },
                      }}
                      onClick={() => handleAction(action)}
                      disabled={action.isDisabled}
                      role="menuitem"
                      className={`
                        w-full flex items-center gap-3 px-4 py-3 text-right transition-colors
                        ${
                          action.isDestructive
                            ? 'text-red-400 hover:bg-red-500/10'
                            : 'text-[var(--fs-ink)] hover:bg-[var(--fs-overlay-hover)]'
                        }
                        ${action.isDisabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
                        ${index !== actions.length - 1 ? 'border-b border-[var(--color-border)]' : ''}
                      `}
                    >
                      <span className="w-5 h-5 flex items-center justify-center opacity-70">
                        {action.icon}
                      </span>
                      <span className="flex-1 text-sm font-medium">{action.label}</span>
                    </m.button>
                  ))}
                </m.div>
              </m.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

export default LongPressMenu;
