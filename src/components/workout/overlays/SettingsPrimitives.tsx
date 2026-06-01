// Settings UI Primitives — Fresh Steel design system
// All visuals use var(--fs-*) tokens (no `bg-white/10` etc.) so the overlay
// matches the rest of the active workout shell, NumpadOverlay, ConfirmExit etc.

import { m } from 'framer-motion';
import { memo } from 'react';

// ============================================================
// HAPTIC
// ============================================================

export const triggerSettingsHaptic = () => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(8);
  }
};

// ============================================================
// CONSTANTS
// ============================================================

export const SETTINGS_TABS = [
  { id: 'general' as const, label: 'כללי' },
  { id: 'rest' as const, label: 'מנוחה' },
  { id: 'audio' as const, label: 'שמע' },
  { id: 'flow' as const, label: 'אימון' },
  { id: 'advanced' as const, label: 'מתקדם' },
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number]['id'];

export const GOALS = [
  { id: 'strength', label: 'כוח' },
  { id: 'hypertrophy', label: 'נפח' },
  { id: 'endurance', label: 'סיבולת' },
  { id: 'flexibility', label: 'גמישות' },
  { id: 'general', label: 'כללי' },
];

export const REST_TIME_OPTIONS = [30, 60, 90, 120, 180, 240];

// ============================================================
// SHARED INLINE STYLES
// ============================================================

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 10,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--fs-muted)',
  fontWeight: 700,
};

// ============================================================
// PRIMITIVES
// ============================================================

/** Toggle row — Fresh Steel surfaces, no opacity-based whites */
export const Toggle = memo<{
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}>(({ label, description, value, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={value}
    onClick={() => {
      triggerSettingsHaptic();
      onChange(!value);
    }}
    className="w-full flex items-center justify-between text-start"
    style={{
      padding: '14px 4px',
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
    }}
  >
    <div className="flex-1 pe-4">
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--fs-ink)',
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
      {description && (
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 12,
            color: 'var(--fs-muted)',
            marginTop: 4,
            lineHeight: 1.35,
          }}
        >
          {description}
        </div>
      )}
    </div>
    <div
      style={{
        position: 'relative',
        width: 50,
        height: 30,
        borderRadius: 999,
        backgroundColor: value ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
        border: '1px solid var(--fs-steel)',
        flexShrink: 0,
        transition: 'background-color 200ms ease',
      }}
    >
      <m.div
        style={{
          position: 'absolute',
          top: 2,
          left: 2,
          width: 24,
          height: 24,
          borderRadius: 999,
          backgroundColor: 'var(--fs-surface)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
        animate={{ x: value ? 21 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      />
    </div>
  </button>
));
Toggle.displayName = 'Toggle';

/** Chip / Segmented Selector — accent for active, surface for inactive */
export const ChipSelector = memo<{
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}>(({ label, options, value, onChange }) => (
  <div style={{ padding: '10px 0' }}>
    <div style={{ ...labelStyle, marginBottom: 10 }}>{label}</div>
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => {
              triggerSettingsHaptic();
              onChange(opt.value);
            }}
            style={{
              padding: '8px 14px',
              borderRadius: 0,
              border: '1.5px solid var(--fs-primary)',
              background: active ? 'var(--fs-accent)' : 'var(--fs-surface)',
              color: 'var(--fs-heading)',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.06em',
              fontWeight: 700,
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'background-color 150ms ease',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  </div>
));
ChipSelector.displayName = 'ChipSelector';

/** Slider with editorial value display */
export const SliderSetting = memo<{
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}>(({ label, description, value, min, max, step = 1, unit = '', onChange }) => {
  const sliderId = `slider-${label.replace(/\s+/g, '-')}`;
  return (
    <div style={{ padding: '14px 0' }}>
      <div className="flex justify-between items-end mb-3">
        <div className="text-start">
          <div
            id={sliderId}
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              fontWeight: 600,
              color: 'var(--fs-ink)',
            }}
          >
            {label}
          </div>
          {description && (
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 12,
                color: 'var(--fs-muted)',
                marginTop: 2,
              }}
            >
              {description}
            </div>
          )}
        </div>
        <div
          className="tabular-nums"
          dir="ltr"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 800,
            color: 'var(--fs-heading)',
            letterSpacing: '-0.01em',
          }}
        >
          {value}
          <span style={{ ...labelStyle, fontSize: 10, marginInlineStart: 4 }}>{unit.trim()}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-labelledby={sliderId}
        onChange={(e) => {
          triggerSettingsHaptic();
          onChange(Number(e.target.value));
        }}
        className="w-full"
        style={{
          height: 6,
          background: 'var(--fs-surface-2)',
          borderRadius: 999,
          appearance: 'none',
          cursor: 'pointer',
          accentColor: 'var(--fs-accent)',
        }}
      />
    </div>
  );
});
SliderSetting.displayName = 'SliderSetting';

/** Goal Selector — 2-col editorial grid */
export const GoalSelector = memo<{ value: string; onChange: (v: string) => void }>(
  ({ value, onChange }) => (
    <div style={{ padding: '10px 0' }}>
      <div style={{ ...labelStyle, marginBottom: 10 }}>מטרת האימון</div>
      <div className="grid grid-cols-2 gap-2">
        {GOALS.map((goal) => {
          const active = value === goal.id;
          return (
            <button
              key={goal.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                triggerSettingsHaptic();
                onChange(goal.id);
              }}
              style={{
                padding: '14px 16px',
                borderRadius: 0,
                background: active ? 'var(--fs-accent)' : 'var(--fs-surface)',
                border: `1.5px solid ${active ? 'var(--fs-primary)' : 'var(--fs-steel)'}`,
                fontFamily: 'var(--font-display)',
                fontSize: 14,
                fontWeight: 800,
                color: 'var(--fs-heading)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                textAlign: 'start',
                cursor: 'pointer',
                transition: 'background-color 150ms ease',
              }}
            >
              {goal.label}
            </button>
          );
        })}
      </div>
    </div>
  )
);
GoalSelector.displayName = 'GoalSelector';

/** Rest Time Selector */
export const RestTimeSelector = memo<{ value: number; onChange: (v: number) => void }>(
  ({ value, onChange }) => (
    <div style={{ padding: '10px 0' }}>
      <div style={{ ...labelStyle, marginBottom: 10 }}>זמן מנוחה ברירת מחדל</div>
      <div className="grid grid-cols-3 gap-2" dir="ltr">
        {REST_TIME_OPTIONS.map((time) => {
          const active = value === time;
          const mins = Math.floor(time / 60);
          const secs = time % 60;
          const label =
            mins === 0
              ? `${secs}s`
              : secs === 0
                ? `${mins}:00`
                : `${mins}:${secs.toString().padStart(2, '0')}`;
          return (
            <button
              key={time}
              type="button"
              onClick={() => {
                triggerSettingsHaptic();
                onChange(time);
              }}
              style={{
                padding: '14px 0',
                borderRadius: 0,
                background: active ? 'var(--fs-accent)' : 'var(--fs-surface)',
                border: `1.5px solid ${active ? 'var(--fs-primary)' : 'var(--fs-steel)'}`,
                color: 'var(--fs-heading)',
                fontFamily: 'var(--font-display)',
                fontSize: 16,
                fontWeight: 800,
                cursor: 'pointer',
                transition: 'background-color 150ms ease',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  )
);
RestTimeSelector.displayName = 'RestTimeSelector';

/** Section Divider */
export const Divider = () => (
  <div
    style={{
      height: 1,
      background: 'var(--fs-surface-2)',
      width: '100%',
      margin: '6px 0',
    }}
  />
);

/** Section Header — mono uppercase kicker */
export const SectionHeader = memo<{ title: string }>(({ title }) => (
  <div
    style={{
      ...labelStyle,
      paddingTop: 18,
      paddingBottom: 8,
    }}
  >
    {title}
  </div>
));
SectionHeader.displayName = 'SectionHeader';

/** Tab Bar — uses Fresh Steel surfaces */
export const TabBar = memo<{
  tabs: readonly { id: string; label: string }[];
  activeTab: string;
  onTabChange: (t: SettingsTab) => void;
}>(({ tabs, activeTab, onTabChange }) => (
  <div className="flex gap-1 px-4 pb-3 overflow-x-auto hide-scrollbar">
    {tabs.map((tab) => {
      const active = activeTab === tab.id;
      return (
        <button
          key={tab.id}
          type="button"
          onClick={() => {
            triggerSettingsHaptic();
            onTabChange(tab.id as SettingsTab);
          }}
          style={{
            flexShrink: 0,
            padding: '10px 16px',
            borderRadius: 0,
            background: active ? 'var(--fs-primary)' : 'var(--fs-surface)',
            color: active ? 'var(--fs-accent)' : 'var(--fs-muted)',
            border: `1px solid ${active ? 'var(--fs-primary)' : 'var(--fs-steel)'}`,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            transition: 'background-color 150ms ease, color 150ms ease',
          }}
        >
          {tab.label}
        </button>
      );
    })}
  </div>
));
TabBar.displayName = 'TabBar';
