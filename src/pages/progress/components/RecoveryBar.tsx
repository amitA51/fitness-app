import { m } from 'framer-motion';
import { memo, useMemo } from 'react';
import { useIsRTL } from '../../../hooks/useIsRTL';
import { useReducedMotion } from '../../../hooks/useReducedMotion';

export const RecoveryBar = memo(function RecoveryBar({
  label,
  value,
  max,
  color,
}: { label: string; value: number; max: number; color: string }) {
  // `max` MUST be the real top of the value's scale. Passing a smaller max used to
  // pin every bar at 100% inside the overflow-hidden track while the label printed
  // an impossible reading (a 0-100 sub-score against max=25 showed "75/25"). The
  // clamp keeps an out-of-range or malformed value from silently re-pinning the
  // fill, so a full bar always means "value reached max".
  const pct = useMemo(() => {
    if (!(max > 0) || !Number.isFinite(value)) return 0;
    return Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  }, [value, max]);
  const isRTL = useIsRTL();
  const reduced = useReducedMotion();

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-semibold" style={{ color: 'var(--fs-muted)' }}>
          {label}
        </span>
        <span className="font-semibold" style={{ color }}>
          {value}/{max}
        </span>
      </div>
      <div
        style={{
          height: 6,
          background: 'var(--fs-surface-2)',
          borderRadius: '9999px',
          overflow: 'hidden',
        }}
      >
        <m.div
          // scaleX on a full-width fill rather than an animated width: width is a
          // layout property, scaleX is composited. The origin follows the writing
          // direction so the bar always grows from the reading-start edge.
          style={{
            height: '100%',
            width: '100%',
            borderRadius: '9999px',
            backgroundColor: color,
            transformOrigin: isRTL ? 'right center' : 'left center',
          }}
          initial={reduced ? false : { scaleX: 0 }}
          animate={{ scaleX: pct / 100 }}
          transition={reduced ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
});
