import { m } from 'framer-motion';
import type React from 'react';

export interface ProgressDotsProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressDots({ currentStep, totalSteps }: ProgressDotsProps) {
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: a progressbar is a read-only status indicator (WAI-ARIA APG); a keyboard tab stop here would be non-actionable and harm focus order (WCAG 2.4.3).
    <div
      className="flex items-center justify-center gap-2 py-4"
      // direction:ltr so the step progression fills left→right (step 1 → N),
      // matching SetProgress and the program progress bar. Under the page's RTL
      // the dots would otherwise advance right→left and read as backwards.
      style={{ direction: 'ltr' }}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-valuenow={currentStep + 1}
      aria-label={`שלב ${currentStep + 1} מתוך ${totalSteps}`}
    >
      {Array.from({ length: totalSteps }).map((_, i) => (
        <m.div
          // biome-ignore lint/suspicious/noArrayIndexKey: positional step progress dots derived from a count, never reordered
          key={i}
          aria-hidden="true"
          layoutId={`progress-dot-${i}`}
          className="h-2 rounded-full"
          style={{
            width: i === currentStep ? '24px' : '10px',
            backgroundColor: i <= currentStep ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      ))}
    </div>
  );
}

export interface StepHeaderProps {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
}

export function StepHeader({ title, subtitle, icon }: StepHeaderProps) {
  return (
    <m.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="text-center mb-6 px-2"
    >
      {icon && (
        <m.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          className="w-14 h-14 flex items-center justify-center mx-auto mb-4"
          style={{
            background: 'var(--fs-primary)',
            color: 'var(--fs-accent)',
            borderRadius: '22px 16px 22px 16px',
          }}
        >
          {icon}
        </m.div>
      )}
      <h2
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          fontSize: '26px',
          color: 'var(--fs-ink)',
          // No textTransform:uppercase — a no-op on Hebrew glyphs and a Latin-
          // display leftover; it would only ever uppercase an interpolated Latin
          // name, which is more correct left as typed.
          letterSpacing: '-0.02em',
          marginBottom: '8px',
        }}
      >
        {title}
      </h2>
      <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--fs-muted)' }}>
        {subtitle}
      </p>
    </m.div>
  );
}
