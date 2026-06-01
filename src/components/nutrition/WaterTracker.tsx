import { useReducedMotion } from '@/hooks/useReducedMotion';
import { DUR, EASE, gsap, useGSAP } from '@/lib/gsap';
import { fireSparks } from '@/lib/gsapSparks';
import { Droplets, Minus, Plus } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
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

/** Watery droplet palette for the add-a-glass splash. */
const DROPLET_COLORS = ['#5BC0EB', '#9BE7FF', '#35B392', '#EAF6FF'];

export const WaterTracker = memo(function WaterTracker({
  selectedDate,
  isToday = true,
}: WaterTrackerProps) {
  const [totalMl, setTotalMl] = useState(0);
  // Bumped only on user-initiated additions so the splash fires on add, never
  // on initial load, date switches, or removals.
  const [addTick, setAddTick] = useState(0);
  const goalMl = getWaterGoal();
  const glassMl = getGlassSize();
  const dateToShow = selectedDate ?? todayStr();

  const reduced = useReducedMotion();
  const sparkContainerRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const prevPctRef = useRef<number | null>(null);

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

  // Water level fills smoothly to the current amount. Increases (a fresh add)
  // get a satisfying overshoot rise; everything else (mount, date change,
  // removal) eases in/out cleanly. Reduced motion snaps to the final width.
  useGSAP(
    () => {
      const fill = fillRef.current;
      if (!fill) return;

      if (reduced) {
        gsap.set(fill, { width: `${pct}%` });
        prevPctRef.current = pct;
        return;
      }

      const prev = prevPctRef.current;
      const isIncrease = prev !== null && pct > prev;
      prevPctRef.current = pct;

      gsap.to(fill, {
        width: `${pct}%`,
        duration: isIncrease ? DUR.base : DUR.fast,
        ease: isIncrease ? EASE.pop : EASE.out,
      });
    },
    { scope: sparkContainerRef, dependencies: [pct, reduced] }
  );

  // Add-a-glass feedback: a tiny droplet splash at the fill's leading edge plus
  // a quick pop on the glasses count. Skipped on first run and reduced motion.
  useGSAP(
    () => {
      if (addTick === 0 || reduced) return;

      const count = countRef.current;
      if (count) {
        gsap.fromTo(
          count,
          { scale: 1 },
          {
            scale: 1.22,
            duration: DUR.micro,
            ease: EASE.popHard,
            yoyo: true,
            repeat: 1,
            transformOrigin: 'center',
          }
        );
      }

      const container = sparkContainerRef.current;
      const fill = fillRef.current;
      if (!container || !fill) return;

      // Origin = the fill's leading (growing) edge. In RTL the fill is anchored
      // to the right and grows left, so its left edge leads; LTR is mirrored.
      const isRTL = document.dir === 'rtl';
      const containerRect = container.getBoundingClientRect();
      const fillRect = fill.getBoundingClientRect();
      const edgeX = isRTL ? fillRect.left : fillRect.right;

      fireSparks(container, {
        count: 8,
        colors: DROPLET_COLORS,
        originX: edgeX - containerRect.left,
        originY: fillRect.top - containerRect.top + fillRect.height / 2,
        // Arc up out of the bar, then gravity pulls the droplets back down.
        angleMin: 240,
        angleMax: 300,
        minVelocity: 120,
        maxVelocity: 260,
        gravity: 700,
        sizeMin: 4,
        sizeMax: 8,
        duration: 0.8,
        mixedShapes: false,
      });
    },
    { scope: sparkContainerRef, dependencies: [addTick, reduced] }
  );

  const handleAdd = useCallback(async () => {
    setTotalMl((prev) => prev + glassMl);
    setAddTick((t) => t + 1);
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
    setAddTick((t) => t + 1);
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
      <div ref={sparkContainerRef} style={{ flex: 1, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--fs-ink)',
            }}
          >
            מים היום
          </span>
          <span
            ref={countRef}
            className="kinetic-number"
            dir="ltr"
            aria-label={`${glasses} מתוך ${goalGlasses} כוסות`}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              letterSpacing: '0.12em',
              color: pct >= 100 ? 'var(--fs-accent)' : 'var(--fs-ink)',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              display: 'inline-block',
            }}
          >
            {glasses}/{goalGlasses}
          </span>
        </div>
        <div className="mt-2 fs-progress-track" style={{ height: 6 }}>
          <div
            ref={fillRef}
            className="fs-progress-fill"
            style={{
              height: '100%',
              width: 0,
              background: pct >= 100 ? 'var(--fs-signal)' : undefined,
            }}
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
