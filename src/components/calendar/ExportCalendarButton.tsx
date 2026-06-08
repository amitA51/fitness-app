/**
 * ExportCalendarButton — Fresh Steel / Obsidian design system
 *
 * Self-contained button that builds and downloads an .ics calendar file
 * from a list of IcsEvent objects. No OAuth, no secrets — pure RFC-5545.
 *
 * Props:
 *   events   — array of IcsEvent to export (button disabled when empty)
 *   filename — suggested download filename (default: "schedule")
 *   label    — override the Hebrew button label
 */

import { Download } from 'lucide-react';
import type React from 'react';
import { useCallback, useState } from 'react';
import { type IcsEvent, buildIcsCalendar, downloadIcs } from '../../utils/icsExport';

// ============================================================================
// Types
// ============================================================================

interface ExportCalendarButtonProps {
  events: IcsEvent[];
  filename?: string;
  label?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * ExportCalendarButton
 *
 * Best surface to mount:
 *   - Coach schedule view (src/pages/coach or a CoachScheduleSection) — feed it
 *     ScheduledWorkout[] mapped to IcsEvent[] (scheduledDate → start, title →
 *     title, id → uid).
 *   - Trainee "My Schedule" panel — feed getMySchedule() results the same way.
 *   - Reminders list — feed Reminder[] mapped to IcsEvent[] where schedule.date
 *     / schedule.time provide the start instant.
 *
 * Example mapping (ScheduledWorkout → IcsEvent):
 *   const icsEvents = workouts.map(w => ({
 *     uid: w.id,
 *     title: w.title ?? 'אימון מתוכנן',
 *     start: `${w.scheduledDate}T08:00:00`,
 *   }));
 */
export const ExportCalendarButton: React.FC<ExportCalendarButtonProps> = ({
  events,
  filename = 'schedule',
  label,
}) => {
  const [justDownloaded, setJustDownloaded] = useState(false);

  const isEmpty = !Array.isArray(events) || events.length === 0;

  const handleClick = useCallback(() => {
    if (isEmpty) return;
    const content = buildIcsCalendar(events);
    downloadIcs(filename, content);
    // Brief visual confirmation — resets after 2 s
    setJustDownloaded(true);
    setTimeout(() => setJustDownloaded(false), 2000);
  }, [events, filename, isEmpty]);

  const buttonLabel = label ?? (justDownloaded ? 'היומן יוצא!' : 'ייצוא ליומן');
  const ariaLabel = isEmpty ? 'ייצוא ליומן — אין אירועים לייצא' : buttonLabel;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isEmpty}
      aria-label={ariaLabel}
      className={[
        // Layout
        'inline-flex items-center justify-center gap-[var(--space-2)]',
        // Sizing — 44px min touch target
        'min-h-[44px] px-[var(--space-4)] py-[var(--space-2)]',
        // Typography
        'font-[var(--font-body)] text-[14px] font-semibold tracking-[0.01em]',
        // Shape — signature asymmetric radius
        'rounded-[var(--radius-asymmetric)]',
        // Colors — surface fill, heading text; active state uses accent
        'bg-[var(--fs-surface)] text-[var(--fs-heading)]',
        'border border-[var(--color-border-strong)]',
        // Hover / focus
        'hover:bg-[var(--fs-surface-2)]',
        'focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-[var(--fs-accent)] focus-visible:ring-offset-2',
        // Press feedback (respects prefers-reduced-motion via Tailwind)
        'active:scale-[0.98] transition-transform duration-100',
        // Disabled
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
        // Confirmation state
        justDownloaded
          ? 'bg-[var(--fs-accent)] text-[var(--color-ink-on-accent)] border-[var(--fs-accent)]'
          : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        // Ensure transition covers background color change for confirmation flash
        transition:
          'transform 100ms ease, background-color 200ms ease, color 200ms ease, border-color 200ms ease',
      }}
    >
      <Download size={18} aria-hidden="true" style={{ flexShrink: 0 }} />
      <span>{buttonLabel}</span>
    </button>
  );
};

export default ExportCalendarButton;
