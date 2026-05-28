import type React from 'react';

interface CustomDumbbellIconProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Custom outline dumbbell icon (distinct from the Lucide `Dumbbell`).
 * Shared by ExerciseFilter and ExerciseList — previously duplicated inline in
 * both with an inaccurate "avoid circular import" comment.
 */
export const CustomDumbbellIcon = ({ className, style }: CustomDumbbellIconProps) => (
  <svg
    className={className}
    style={style}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    role="img"
    aria-label="משקולת"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 11a7.5 7.5 0 01-3.5 13M19 11h-5m5 0a7.5 7.5 0 00-7.5-7.5m7.5 7.5V5.5a2.5 2.5 0 00-5 0V11m-9.5 7h4.5m-4.5 0a7.5 7.5 0 017-5.5m0 0H9m2.5 0V5.5a2.5 2.5 0 00-5 0V11m2.5 0h-2.5m2.5 0a7.5 7.5 0 017 5.5"
    />
  </svg>
);
