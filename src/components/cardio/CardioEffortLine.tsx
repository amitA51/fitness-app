import { memo } from 'react';
import type { CardioEffort } from '../../utils/cardio';
import { cardioDistance, cardioPace, formatClock } from '../../utils/cardio';

interface CardioEffortLineProps {
  effort: Pick<CardioEffort, 'activity' | 'distanceKm' | 'durationSec'>;
  /** Show the pace / speed too (default true). */
  withPace?: boolean;
}

/**
 * "28:40 · 5.2 ק״מ · 5:31 דק׳/ק״מ" — the one-line summary of a cardio effort,
 * every number bidi-isolated so the line reads right inside Hebrew text.
 */
export const CardioEffortLine = memo(function CardioEffortLine({
  effort,
  withPace = true,
}: CardioEffortLineProps) {
  const dist = cardioDistance(effort.activity, effort.distanceKm);
  const pace = withPace ? cardioPace(effort.activity, effort.distanceKm, effort.durationSec) : null;
  return (
    <span>
      <span className="kinetic-number">{formatClock(effort.durationSec)}</span>
      {dist && (
        <>
          {' · '}
          <span className="kinetic-number">{dist.value}</span> {dist.unit}
        </>
      )}
      {pace && (
        <>
          {' · '}
          <span className="kinetic-number">{pace.value}</span> {pace.unit}
        </>
      )}
    </span>
  );
});

/** Plain-text twin of CardioEffortLine, for share text and screen-reader labels. */
export function cardioEffortText(
  effort: Pick<CardioEffort, 'activity' | 'distanceKm' | 'durationSec'>
): string {
  const parts = [formatClock(effort.durationSec)];
  const dist = cardioDistance(effort.activity, effort.distanceKm);
  if (dist) parts.push(`${dist.value} ${dist.unit}`);
  const pace = cardioPace(effort.activity, effort.distanceKm, effort.durationSec);
  if (pace) parts.push(`${pace.value} ${pace.unit}`);
  return parts.join(' · ');
}
