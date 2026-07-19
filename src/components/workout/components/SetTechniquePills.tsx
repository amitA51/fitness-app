// SetTechniquePills - toggle row for marking the active set as
// warmup / drop-set / failure / rest-pause. Each pill toggles independently.
// Fresh Steel chip styling, matches existing RPE/chip language.

import { memo, useCallback } from 'react';
import type { SetTechnique, WorkoutSet } from '../../../types';
import { triggerHaptic } from '../../../utils/haptics';

interface SetTechniquePillsProps {
  set: WorkoutSet;
  onToggle: (technique: SetTechnique, value: boolean) => void;
}

interface PillConfig {
  technique: SetTechnique;
  label: string;
  fullLabel: string;
  active: boolean;
}

const SetTechniquePills = memo<SetTechniquePillsProps>(({ set, onToggle }) => {
  const handle = useCallback(
    (t: SetTechnique, current: boolean) => {
      triggerHaptic('light');
      onToggle(t, !current);
    },
    [onToggle]
  );

  const pills: PillConfig[] = [
    {
      technique: 'warmup',
      label: 'חימום',
      fullLabel: 'סט חימום',
      active: !!set.isWarmup,
    },
    {
      technique: 'dropSet',
      label: 'דרופ',
      fullLabel: 'דרופ-סט',
      active: !!set.isDropSet,
    },
    {
      technique: 'failure',
      label: 'כשל',
      fullLabel: 'עד כשל',
      active: !!set.isFailure,
    },
    {
      technique: 'restPause',
      label: 'מנוחה-קצרה',
      fullLabel: 'רסט-פוז',
      active: !!set.isRestPause,
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
      aria-label="סוג הסט"
      role="group"
    >
      {pills.map((p) => (
        <button
          key={p.technique}
          type="button"
          aria-pressed={p.active}
          aria-label={p.fullLabel}
          title={p.fullLabel}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handle(p.technique, p.active);
          }}
          style={{
            flexShrink: 0,
            padding: '6px 12px',
            background: p.active ? 'var(--fs-accent)' : 'var(--fs-surface)',
            border: '1px solid var(--fs-steel)',
            borderRadius: '12px 8px 12px 8px',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '-0.01em',
            color: p.active ? 'var(--color-ink-on-accent)' : 'var(--fs-muted)',
            cursor: 'pointer',
            transition: 'background 120ms ease, color 120ms ease',
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
});

SetTechniquePills.displayName = 'SetTechniquePills';

export default SetTechniquePills;
