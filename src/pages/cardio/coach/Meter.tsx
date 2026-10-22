// A labelled progress bar: the words carry the numbers (screen readers read
// them), the bar is decoration. An optional band marks the recommended range.

import type { ReactNode } from 'react';

interface MeterProps {
  label: string;
  /** Shown at the end of the label row — the number, already formatted. */
  value: ReactNode;
  /** Fill, 0–1. */
  share: number;
  /** Recommended range on the same 0–1 scale. */
  band?: { from: number; to: number };
  /** One muted line under the bar. */
  caption?: ReactNode;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, Number.isFinite(x) ? x : 0));
const pct = (x: number) => `${Math.round(clamp01(x) * 1000) / 10}%`;

export function Meter({ label, value, share, band, caption }: MeterProps) {
  return (
    <div className="rc-meter">
      <div className="rc-meter-head">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="rc-bar" aria-hidden="true">
        <span className="rc-bar-fill" style={{ width: pct(share) }} />
        {band && (
          <span
            className="rc-bar-band"
            style={{ insetInlineStart: pct(band.from), width: pct(band.to - band.from) }}
          />
        )}
      </div>
      {caption && <p className="rc-muted">{caption}</p>}
    </div>
  );
}
