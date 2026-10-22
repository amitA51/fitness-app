// The kilometres of one effort as bars: faster = longer, the fastest in mint.

import type { CardioSplit } from '../../../types';
import { formatPace } from '../../../utils/cardio';

interface SplitListProps {
  splits: readonly CardioSplit[];
}

export function SplitList({ splits }: SplitListProps) {
  const perKm = splits.filter((s) => s.distanceKm > 0).map((s) => s.seconds / s.distanceKm);
  if (perKm.length === 0) return null;
  const fastest = Math.min(...perKm);
  const slowest = Math.max(...perKm);
  // Faster = longer bar; the slowest still shows a sliver.
  const range = slowest - fastest || 1;

  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {splits.map((s, i) => {
        if (s.distanceKm <= 0) return null;
        const pace = s.seconds / s.distanceKm;
        const width = 35 + 65 * ((slowest - pace) / range);
        return (
          <div
            // Several sets can each restart at kilometre 1, so the index is not unique.
            // biome-ignore lint/suspicious/noArrayIndexKey: the list is static per render
            key={i}
            className="cardio-split-row"
            data-best={pace === fastest && perKm.length > 1 ? 'true' : undefined}
          >
            <span>
              {s.distanceKm < 1 ? (
                <>
                  <span className="kinetic-number">{Math.round(s.distanceKm * 1000)}</span> מ׳
                </>
              ) : (
                <>
                  ק״מ <span className="kinetic-number">{s.index}</span>
                </>
              )}
            </span>
            <span className="cardio-split-bar" aria-hidden="true">
              <span style={{ width: `${width}%` }} />
            </span>
            <span className="kinetic-number" dir="ltr" style={{ justifySelf: 'end' }}>
              {formatPace(pace)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
