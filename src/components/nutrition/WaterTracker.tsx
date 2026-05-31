import { motion } from 'framer-motion';
import { Droplets, Minus, Plus } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import {
  WATER_UPDATED_EVENT,
  addWaterEntry,
  getGlassSize,
  getWaterGoal,
  getWaterTotalForDate,
} from '../../services/waterService';
import { todayStr } from '../../utils/dateUtils';

interface WaterTrackerProps {
  /** Day the page is showing. Defaults to today. */
  selectedDate?: string;
  /** Whether the selected day is today. Controls add/remove (water logs to today). */
  isToday?: boolean;
}

export const WaterTracker = memo(function WaterTracker({
  selectedDate,
  isToday = true,
}: WaterTrackerProps) {
  const [totalMl, setTotalMl] = useState(0);
  const goalMl = getWaterGoal();
  const glassMl = getGlassSize();
  const dateToShow = selectedDate ?? todayStr();

  const loadTotal = useCallback(async () => {
    const t = await getWaterTotalForDate(dateToShow);
    setTotalMl(t);
  }, [dateToShow]);

  useEffect(() => {
    loadTotal();
    // Refresh whenever water changes anywhere (mirrors the settings-updated
    // pattern), so the displayed total never goes stale after a glass is added.
    window.addEventListener(WATER_UPDATED_EVENT, loadTotal);
    return () => window.removeEventListener(WATER_UPDATED_EVENT, loadTotal);
  }, [loadTotal]);

  const pct = goalMl > 0 ? Math.min(Math.round((totalMl / goalMl) * 100), 100) : 0;
  const glasses = glassMl > 0 ? Math.round(totalMl / glassMl) : 0;
  const goalGlasses = glassMl > 0 ? Math.round(goalMl / glassMl) : 0;

  const handleAdd = useCallback(async () => {
    setTotalMl((prev) => prev + glassMl);
    try {
      await addWaterEntry(glassMl);
    } catch {
      setTotalMl((prev) => Math.max(0, prev - glassMl));
    }
  }, [glassMl]);

  const handleRemove = useCallback(async () => {
    if (totalMl <= 0) return;
    setTotalMl((prev) => Math.max(0, prev - glassMl));
    try {
      await addWaterEntry(-glassMl);
    } catch {
      setTotalMl((prev) => prev + glassMl);
    }
  }, [glassMl, totalMl]);

  const handleQuickAdd = useCallback(async (amountMl: number) => {
    setTotalMl((prev) => prev + amountMl);
    try {
      await addWaterEntry(amountMl);
    } catch {
      setTotalMl((prev) => Math.max(0, prev - amountMl));
    }
  }, []);

  return (
    <div
      role="region"
      aria-label="מעקב שתייה"
      className="magnetic-card glass-surface fs-accent-rail scrim-noise"
      style={{
        margin: '16px 0',
        padding: '14px 16px',
        border: '1px solid var(--fs-surface-2)',
        background: 'var(--fs-surface)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <Droplets size={20} style={{ color: 'var(--fs-accent)', flexShrink: 0 }} aria-hidden="true" />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--fs-ink)',
            }}
          >
            שתייה
          </span>
          <span
            className="kinetic-number"
            dir="ltr"
            aria-label={`${glasses} מתוך ${goalGlasses} כוסות`}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '0.12em',
              color: pct >= 100 ? 'var(--fs-accent)' : 'var(--fs-ink)',
              fontWeight: 600,
            }}
          >
            {glasses}/{goalGlasses}
          </span>
        </div>
        <div className="mt-2 fs-progress-track" style={{ height: 6 }}>
          <motion.div
            className="fs-progress-fill"
            style={{
              height: '100%',
              background: pct >= 100 ? 'var(--fs-signal)' : undefined,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {!isToday ? (
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.12em',
              color: 'var(--fs-muted)',
              alignSelf: 'center',
              textTransform: 'uppercase',
            }}
          >
            היום בלבד
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={handleRemove}
              disabled={totalMl <= 0}
              aria-label="הסר כוס מים"
              className="icon-btn"
              style={{
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--fs-surface-2)',
                border: 'none',
                cursor: totalMl <= 0 ? 'not-allowed' : 'pointer',
                opacity: totalMl <= 0 ? 0.4 : 1,
              }}
            >
              <Minus size={16} style={{ color: 'var(--fs-heading)' }} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleAdd}
              aria-label={`הוסף כוס (${glassMl} מ״ל)`}
              className="icon-btn accent-glow"
              style={{
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--fs-accent)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Plus size={16} style={{ color: 'var(--fs-heading)' }} aria-hidden="true" />
            </button>
            {/* Quick water buttons: +250ml pill */}
            <button
              type="button"
              onClick={() => handleQuickAdd(250)}
              aria-label="הוסף 250 מ״ל"
              dir="ltr"
              style={{
                padding: '0 12px',
                minWidth: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--fs-accent)',
                border: 'none',
                cursor: 'pointer',
                borderRadius: 0,
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--fs-heading)',
                gap: 3,
              }}
            >
              +250
            </button>
            <button
              type="button"
              onClick={() => handleQuickAdd(500)}
              aria-label="הוסף 500 מ״ל"
              dir="ltr"
              style={{
                padding: '0 12px',
                minWidth: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--fs-accent)',
                border: 'none',
                cursor: 'pointer',
                borderRadius: 0,
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--fs-heading)',
                gap: 3,
              }}
            >
              +500
            </button>
          </>
        )}
      </div>
    </div>
  );
});
