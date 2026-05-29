/**
 * Accessible UI Components
 *
 * Production-ready accessible components following WCAG 2.1 guidelines.
 * Includes proper ARIA attributes, keyboard navigation, and focus management.
 */

import { AnimatePresence, motion } from 'framer-motion';
import type React from 'react';
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { DURATION, fadeVariants, popInVariants } from '../../utils/animations';
import { cn } from '../../utils/styles';

// ============================================================================
// Accessible Button
// ============================================================================

interface AccessibleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Loading state */
  isLoading?: boolean;
  /** Loading text for screen readers */
  loadingText?: string;
  /** Left icon */
  leftIcon?: ReactNode;
  /** Right icon */
  rightIcon?: ReactNode;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  (
    {
      children,
      isLoading = false,
      loadingText = 'טוען...',
      leftIcon,
      rightIcon,
      variant = 'primary',
      size = 'md',
      disabled,
      className,
      ...props
    },
    ref
  ) => {
    const variantClasses = {
      primary:
        'bg-[var(--fs-accent)] text-[var(--fs-primary)] hover:brightness-110 shadow-[0_0_15px_var(--dynamic-accent-glow)]',
      secondary:
        'bg-[var(--fs-overlay-hover)] text-[var(--fs-ink)] border border-[var(--color-border)] hover:bg-[var(--fs-overlay-active)]',
      ghost: 'bg-transparent text-[var(--fs-ink)] hover:bg-[var(--fs-overlay-hover)]',
      danger: 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20',
    };

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm min-h-[32px]',
      md: 'px-4 py-2.5 text-base min-h-[44px]',
      lg: 'px-6 py-3 text-lg min-h-[52px]',
    };

    return (
      <button
        type="button"
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        aria-disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center gap-2',
          'font-medium rounded-xl',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-[var(--fs-accent)] focus:ring-offset-2 focus:ring-offset-transparent',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'active:scale-[0.98]',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="sr-only">{loadingText}</span>
            <span
              className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"
              aria-hidden="true"
            />
            <span aria-hidden="true">{loadingText}</span>
          </>
        ) : (
          <>
            {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
            {children}
            {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';

// ============================================================================
// Accessible Input
// ============================================================================

interface AccessibleInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Input label */
  label: string;
  /** Helper text */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Hide label visually (still accessible) */
  hideLabel?: boolean;
  /** Input size */
  size?: 'sm' | 'md' | 'lg';
  /** Left addon (icon or text) */
  leftAddon?: ReactNode;
  /** Right addon (icon or text) */
  rightAddon?: ReactNode;
}

export const AccessibleInput = forwardRef<HTMLInputElement, AccessibleInputProps>(
  (
    {
      label,
      helperText,
      error,
      hideLabel = false,
      size = 'md',
      leftAddon,
      rightAddon,
      className,
      id: providedId,
      required,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const helperId = `${id}-helper`;
    const errorId = `${id}-error`;

    const sizeClasses = {
      sm: 'py-1.5 text-sm',
      md: 'py-2.5 text-base',
      lg: 'py-3 text-lg',
    };

    return (
      <div className="w-full">
        <label
          htmlFor={id}
          className={cn(
            'block text-sm font-medium text-[var(--text-secondary)] mb-2',
            hideLabel && 'sr-only'
          )}
        >
          {label}
          {required && (
            <span className="text-red-400 mr-1" aria-hidden="true">
              *
            </span>
          )}
        </label>

        <div className="relative">
          {leftAddon && (
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
              aria-hidden="true"
            >
              {leftAddon}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            disabled={disabled}
            required={required}
            aria-required={required}
            aria-invalid={!!error}
            aria-describedby={cn(helperText && helperId, error && errorId) || undefined}
            className={cn(
              'w-full px-4 rounded-xl',
              'bg-[var(--fs-overlay-hover)] border',
              error ? 'border-red-500/50' : 'border-[var(--color-border)]',
              'text-[var(--fs-ink)] placeholder:text-[var(--text-tertiary)]',
              'focus:outline-none focus:ring-2',
              error ? 'focus:ring-red-500' : 'focus:ring-[var(--fs-accent)]',
              'focus:border-transparent',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              leftAddon ? 'pr-10' : '',
              rightAddon ? 'pl-10' : '',
              sizeClasses[size],
              className
            )}
            {...props}
          />

          {rightAddon && (
            <div
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
              aria-hidden="true"
            >
              {rightAddon}
            </div>
          )}
        </div>

        {helperText && !error && (
          <p id={helperId} className="mt-1.5 text-xs text-[var(--text-tertiary)]">
            {helperText}
          </p>
        )}

        {error && (
          <p id={errorId} className="mt-1.5 text-xs text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);

AccessibleInput.displayName = 'AccessibleInput';

// ============================================================================
// Accessible Modal
// ============================================================================

interface AccessibleModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Close handler */
  onClose: () => void;
  /** Modal title */
  title: string;
  /** Modal description for screen readers */
  description?: string;
  /** Modal content */
  children: ReactNode;
  /** Size of modal */
  size?: 'sm' | 'md' | 'lg' | 'full';
  /** Close on backdrop click */
  closeOnBackdrop?: boolean;
  /** Close on Escape key */
  closeOnEscape?: boolean;
}

export const AccessibleModal: React.FC<AccessibleModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  closeOnBackdrop = true,
  closeOnEscape = true,
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Store previously focused element and restore on close
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      // Focus the modal after animation
      const timerId = setTimeout(() => {
        modalRef.current?.focus();
      }, DURATION.normal * 1000);
      return () => clearTimeout(timerId);
    }
    previousActiveElement.current?.focus();
    return undefined;
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // Trap focus inside modal
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !modalRef.current) return;

    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement?.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement?.focus();
    }
  }, []);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-2xl',
    full: 'max-w-[90vw] max-h-[80vh]',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="presentation"
        >
          {/* Backdrop */}
          <motion.div
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={closeOnBackdrop ? onClose : undefined}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            ref={modalRef}
            variants={popInVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            tabIndex={-1}
            onKeyDown={handleKeyDown}
            className={cn(
              'relative w-full',
              'bg-[var(--bg-card)] border border-[var(--color-border)]',
              'rounded-2xl shadow-2xl',
              'overflow-hidden',
              sizeClasses[size]
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
              <h2 id={titleId} className="text-xl font-bold text-[var(--fs-ink)]">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-[var(--fs-overlay-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--fs-accent)]"
                aria-label="סגור"
              >
                <svg
                  className="w-5 h-5 text-[var(--text-secondary)]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Description (for screen readers) */}
            {description && (
              <p id={descriptionId} className="sr-only">
                {description}
              </p>
            )}

            {/* Content */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// ============================================================================
// Skip Link (for keyboard navigation)
// ============================================================================

interface SkipLinkProps {
  /** Target element ID */
  targetId: string;
  /** Link text */
  children?: ReactNode;
}

export const SkipLink: React.FC<SkipLinkProps> = ({ targetId, children = 'דלג לתוכן הראשי' }) => (
  <a
    href={`#${targetId}`}
    className={cn(
      'absolute -top-10 right-4 z-50',
      'focus:top-4',
      'bg-[var(--fs-accent)] text-[var(--fs-primary)]',
      'px-4 py-2 rounded-lg font-medium',
      'transition-all duration-200',
      'focus:outline-none focus:ring-2 focus:ring-white'
    )}
  >
    {children}
  </a>
);

// ============================================================================
// Visually Hidden (screen reader only)
// ============================================================================

interface VisuallyHiddenProps {
  children: ReactNode;
  /** Render as different element */
  as?: 'span' | 'div' | 'p' | 'label';
}

export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({ children, as = 'span' }) => {
  const Element = as;
  return <Element className="sr-only">{children}</Element>;
};

// ============================================================================
// Live Region (for dynamic announcements)
// ============================================================================

interface LiveRegionProps {
  /** Message to announce */
  message: string;
  /** Politeness level */
  politeness?: 'polite' | 'assertive';
  /** Clear message after timeout (ms) */
  clearAfter?: number;
}

export const LiveRegion: React.FC<LiveRegionProps> = ({
  message,
  politeness = 'polite',
  clearAfter,
}) => {
  const [currentMessage, setCurrentMessage] = useState(message);

  useEffect(() => {
    setCurrentMessage(message);

    if (clearAfter && message) {
      const timer = setTimeout(() => setCurrentMessage(''), clearAfter);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [message, clearAfter]);

  return (
    <div role="status" aria-live={politeness} aria-atomic="true" className="sr-only">
      {currentMessage}
    </div>
  );
};

// ============================================================================
// Focus Trap (for modals and dropdowns)
// ============================================================================

interface FocusTrapProps {
  /** Whether focus trap is active */
  active: boolean;
  /** Content to trap focus within */
  children: ReactNode;
}

export const FocusTrap: React.FC<FocusTrapProps> = ({ active, children }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [active]);

  return <div ref={containerRef}>{children}</div>;
};

// ============================================================================
// Accessible Tabs
// ============================================================================

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

interface AccessibleTabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  className?: string;
}

export const AccessibleTabs: React.FC<AccessibleTabsProps> = ({
  tabs,
  defaultTab,
  onChange,
  className,
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');
  const tablistRef = useRef<HTMLDivElement>(null);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const enabledTabs = tabs.filter((t) => !t.disabled);
    const currentEnabledIndex = enabledTabs.findIndex((t) => t.id === tabs[index]?.id);

    let newIndex: number | null = null;

    switch (e.key) {
      case 'ArrowLeft':
        newIndex = currentEnabledIndex > 0 ? currentEnabledIndex - 1 : enabledTabs.length - 1;
        break;
      case 'ArrowRight':
        newIndex = currentEnabledIndex < enabledTabs.length - 1 ? currentEnabledIndex + 1 : 0;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = enabledTabs.length - 1;
        break;
    }

    if (newIndex !== null) {
      const newTab = enabledTabs[newIndex];
      if (newTab) {
        e.preventDefault();
        setActiveTab(newTab.id);
        onChange?.(newTab.id);

        // Focus the new tab
        const buttons = tablistRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
        const targetButton = Array.from(buttons || []).find(
          (btn) => btn.getAttribute('aria-controls') === `panel-${newTab.id}`
        );
        targetButton?.focus();
      }
    }
  };

  const activeContent = tabs.find((t) => t.id === activeTab)?.content;

  return (
    <div className={className}>
      {/* Tab List */}
      <div
        ref={tablistRef}
        role="tablist"
        aria-orientation="horizontal"
        className="flex gap-1"
        style={{
          background: 'var(--fs-surface-2)',
          borderRadius: 16,
          padding: 4,
          border: '1px solid var(--fs-surface-2)',
        }}
      >
        {tabs.map((tab, index) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              aria-disabled={tab.disabled}
              tabIndex={isActive ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => handleTabClick(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={cn(
                'transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-[var(--fs-accent)] focus:ring-inset',
                tab.disabled && 'opacity-50 cursor-not-allowed'
              )}
              style={{
                background: isActive ? 'var(--fs-surface)' : 'transparent',
                color: isActive ? 'var(--fs-ink)' : 'var(--fs-muted)',
                borderRadius: 12,
                minHeight: 36,
                fontFamily: 'var(--font-body)',
                fontWeight: 900,
                fontSize: 12,
                flex: '1 1 0',
                padding: '0 8px',
                border: 0,
                cursor: tab.disabled ? 'not-allowed' : 'pointer',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={activeTab !== tab.id}
          className="mt-4 focus:outline-none"
        >
          {activeTab === tab.id && activeContent}
        </div>
      ))}
    </div>
  );
};
