/** iOS-style toggle switch — 32px visual track centered in a ≥44px tap area */
import { useEffect, useState } from 'react';
import { triggerHaptic } from '../../utils/haptics';

const DARK_CLASS = 'dark';

const readDarkTheme = (): boolean => {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains(DARK_CLASS);
};

/**
 * True when the Obsidian dark theme is active.
 *
 * Read from `<html class="dark">` (owned by SettingsContext) rather than from the
 * context itself, so the switch keeps working if it is ever mounted outside
 * `SettingsProvider`. Observed rather than read once — a one-shot read would
 * freeze at the boot theme and miss every later toggle, which matters here
 * because one of these switches IS the dark-mode control.
 */
const useIsDarkTheme = (): boolean => {
  const [isDark, setIsDark] = useState<boolean>(readDarkTheme);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;

    const target = document.documentElement;
    const sync = () => {
      setIsDark(target.classList.contains(DARK_CLASS));
    };
    sync();

    const observer = new MutationObserver(sync);
    observer.observe(target, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
};

// ----------------------------------------------------------------------------
// Dark-mode contrast — the track edge, the knob, and the ON fill
// ----------------------------------------------------------------------------
// The border and the OFF knob were both `--fs-primary`, which does NOT invert
// (#16292d light -> #0a0a0a dark). In dark that painted #0a0a0a on the #262626
// OFF track: 1.31:1. The control had no visible edge and no visible knob, and it
// was 1.05:1 against the #111111 card it sits on — an invisible switch.
//
// `--fs-ink` is the base foreground token and DOES invert (#132327 -> #f0f0f0):
// 12.67:1 / 13.28:1 on the OFF fill (light / dark), 16.19:1 / 16.57:1 on the card.
//
// `--color-border-strong` is NOT usable here: in dark it is rgba(255,255,255,.26),
// which composites over the OFF fill to #5e5e5e = 2.33:1 — under the 3:1 WCAG
// 1.4.11 asks of a component boundary.
//
// A light edge then collides with the bright dark mint: #f0f0f0 on --fs-accent
// #4ddcbb is 1.50:1. No knob or border fill can satisfy both track states at once
// (clearing 3:1 on the OFF fill needs L>=0.1581, clearing it on the bright ON fill
// needs L<=0.1545 — empty set), so the ON TRACK is what moves in dark.
//
// #318d78 is --fs-accent (#4ddcbb) with every channel scaled 0.64 — the same
// method tokens.css already uses for --btn-primary-bg-hover (#42bda1 = accent
// x 0.86). Identical hue (166.2deg) and saturation, lower value, so no third
// accent colour is introduced. L=0.2106 lands inside the only viable window:
//   border / knob vs ON track   3.54:1  (was 1.50:1 with a light edge)
//   ON track vs OFF track       3.76:1  (state readable on fill alone)
//   ON knob (--fs-surface)      4.69:1
// Light mode keeps both fills exactly as they were (--fs-accent / --fs-surface-2),
// so nothing there changes shade; only the near-black edge shifts #16292d ->
// #132327 (11.83:1 -> 12.67:1 on the OFF fill), which is imperceptible and up.
const TRACK_CHECKED_DARK = '#318d78';

/**
 * Track fill for a given state and theme. Exported so the contrast-critical
 * choice can be asserted directly rather than inferred from a rendered pixel.
 */
export const trackBackground = (checked: boolean, isDark: boolean): string => {
  if (!checked) return 'var(--fs-surface-2)';
  return isDark ? TRACK_CHECKED_DARK : 'var(--fs-accent)';
};

interface SettingsToggleProps {
  checked: boolean;
  onChange: () => void;
  label: string;
  /** Renders the toggle in a visually dimmed, non-interactive state */
  disabled?: boolean;
}

export function SettingsToggle({
  checked,
  onChange,
  label,
  disabled = false,
}: SettingsToggleProps) {
  const isDark = useIsDarkTheme();

  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      onClick={
        disabled
          ? undefined
          : () => {
              triggerHaptic('light'); // meaningful snap on the deliberate toggle
              onChange();
            }
      }
      className="focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)] focus-visible:outline-none"
      style={{
        // Tap target ≥44×44 (a11y); the visual track inside stays ~32px tall.
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '44px',
        minHeight: '44px',
        flexShrink: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        background: 'transparent',
        border: 'none',
        padding: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{ position: 'relative', display: 'inline-block', width: '52px', height: '32px' }}
      >
        <span
          style={{
            position: 'absolute',
            inset: 0,
            background: trackBackground(checked, isDark),
            border: '2px solid var(--fs-ink)',
            borderRadius: 12,
            transition: 'background 150ms ease',
          }}
        />
        <span
          style={{
            position: 'absolute',
            top: '4px',
            insetInlineStart: checked ? '24px' : '4px',
            width: '24px',
            height: '24px',
            // The knob is the foreground figure, so it contrasts whatever track it
            // sits on: --fs-ink on the quiet OFF fill, --fs-surface on the mint ON
            // fill. --fs-primary used to hold the OFF slot and never inverted, which
            // made the knob the darkest thing in a dark track (1.31:1).
            background: checked ? 'var(--fs-surface)' : 'var(--fs-ink)',
            borderRadius: '50%',
            transition: 'inset-inline-start 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            pointerEvents: 'none',
          }}
        />
      </span>
      <style>{`@media (prefers-reduced-motion: reduce) { button[role="switch"] span { transition: none !important; } }`}</style>
    </button>
  );
}

export default SettingsToggle;
