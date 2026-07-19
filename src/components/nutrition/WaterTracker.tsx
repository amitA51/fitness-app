import { useReducedMotion } from '@/hooks/useReducedMotion';
import { DUR, EASE, gsap, useGSAP } from '@/lib/gsap';
import { fireSparks } from '@/lib/gsapSparks';
import { zoneColor } from '@/utils/zoneColor';
import { Droplets, Minus, Plus } from 'lucide-react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { showToast } from '../../components/ui/GlobalToast';
import {
  WATER_UPDATED_EVENT,
  addWaterEntry,
  getGlassSize,
  getWaterGoal,
  getWaterTotalForDate,
} from '../../services/waterService';
import { todayStr } from '../../utils/dateUtils';
import { triggerHapticEffect } from '../../utils/haptics';

interface WaterTrackerProps {
  /** Day the page is showing. Defaults to today. */
  selectedDate?: string;
  /** Whether the selected day is today. Controls add/remove (water logs to today). */
  isToday?: boolean;
}

/** Watery droplet palette for the add-a-glass splash. */
const DROPLET_COLORS = ['#5BC0EB', '#9BE7FF', '#35B392', '#EAF6FF'];

/** One-tap quick-add volumes; an amount equal to the glass size is hidden. */
const QUICK_ADD_AMOUNTS_ML = [250, 500];

export const WaterTracker = memo(function WaterTracker({
  selectedDate,
  isToday = true,
}: WaterTrackerProps) {
  const [totalMl, setTotalMl] = useState(0);
  // Bumped only on user-initiated additions so the splash fires on add, never
  // on initial load, date switches, or removals.
  const [addTick, setAddTick] = useState(0);
  // Read once on mount instead of re-parsing localStorage on every render.
  // Kept live via the WATER_UPDATED_EVENT handler below, which also fires when
  // the user edits the goal/glass size in GoalsEditor (saveWaterSettings
  // broadcasts the same event), so behavior matches the old render-body reads.
  const [goalMl, setGoalMl] = useState(getWaterGoal);
  const [glassMl, setGlassMl] = useState(getGlassSize);
  const dateToShow = selectedDate ?? todayStr();

  const reduced = useReducedMotion();
  const sparkContainerRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLSpanElement>(null);
  const prevPctRef = useRef<number | null>(null);
  // Fires the goal celebration once per day. Latched true as soon as the day
  // loads already at/over goal so re-opening the page (or further adds past
  // 100%) doesn't re-fire it; reset whenever the shown day changes.
  const goalCelebratedRef = useRef(false);

  const loadTotal = useCallback(async () => {
    const t = await getWaterTotalForDate(dateToShow);
    setTotalMl(t);
    // If the day is already complete on load, latch so we never celebrate a
    // goal that was reached earlier (or on a previous session).
    if (goalMl > 0 && t >= goalMl) goalCelebratedRef.current = true;
  }, [dateToShow, goalMl]);

  // A fresh day starts un-celebrated. loadTotal re-latches if it's already done.
  // biome-ignore lint/correctness/useExhaustiveDependencies: dateToShow is listed to intentionally re-run this latch reset when the shown day changes; the body only writes a ref.
  useEffect(() => {
    goalCelebratedRef.current = false;
  }, [dateToShow]);

  // Fires the goal toast + success haptic the first time the running total
  // crosses the goal. Takes the projected new total so it can run from the
  // optimistic add handlers (before state/pct recompute).
  const celebrateIfGoalReached = useCallback(
    (newTotalMl: number) => {
      if (goalMl <= 0 || goalCelebratedRef.current) return;
      if (newTotalMl < goalMl) return;
      goalCelebratedRef.current = true;
      triggerHapticEffect('success');
      showToast('הגעת ליעד המים היומי!', { variant: 'water' });
    },
    [goalMl]
  );

  useEffect(() => {
    loadTotal();
    // Refresh whenever water changes anywhere (mirrors the settings-updated
    // pattern), so the displayed total never goes stale after a glass is added.
    // The same event fires when the goal/glass size is edited, so re-read both
    // here to keep them live (they used to be read in the render body).
    const onWaterUpdated = () => {
      setGoalMl(getWaterGoal());
      setGlassMl(getGlassSize());
      loadTotal();
    };
    window.addEventListener(WATER_UPDATED_EVENT, onWaterUpdated);
    return () => window.removeEventListener(WATER_UPDATED_EVENT, onWaterUpdated);
  }, [loadTotal]);

  const pct = goalMl > 0 ? Math.min(Math.round((totalMl / goalMl) * 100), 100) : 0;
  const glasses = glassMl > 0 ? Math.round(totalMl / glassMl) : 0;
  const goalGlasses = glassMl > 0 ? Math.round(goalMl / glassMl) : 0;
  // Hitting the daily hydration goal is on-track, NOT a PR — grade it with the
  // 'good' zone (accent), never --fs-signal (lime, reserved for PR celebration).
  const goalReachedColor = zoneColor('good');

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
    triggerHapticEffect('tap', 'light');
    setTotalMl((prev) => prev + glassMl);
    celebrateIfGoalReached(totalMl + glassMl);
    setAddTick((t) => t + 1);
    try {
      await addWaterEntry(glassMl);
    } catch {
      setTotalMl((prev) => Math.max(0, prev - glassMl));
    }
  }, [glassMl, totalMl, celebrateIfGoalReached]);

  const handleRemove = useCallback(async () => {
    if (totalMl <= 0) return;
    setTotalMl((prev) => Math.max(0, prev - glassMl));
    try {
      await addWaterEntry(-glassMl);
    } catch {
      setTotalMl((prev) => prev + glassMl);
    }
  }, [glassMl, totalMl]);

  const handleQuickAdd = useCallback(
    async (amountMl: number) => {
      triggerHapticEffect('tap', 'light');
      setTotalMl((prev) => prev + amountMl);
      celebrateIfGoalReached(totalMl + amountMl);
      setAddTick((t) => t + 1);
      try {
        await addWaterEntry(amountMl);
      } catch {
        setTotalMl((prev) => Math.max(0, prev - amountMl));
      }
    },
    [totalMl, celebrateIfGoalReached]
  );

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
            aria-label={`${glasses} מתוך ${goalGlasses} כוסות`}
            style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}
          >
            <span
              ref={countRef}
              className="kinetic-number"
              dir="ltr"
              aria-hidden="true"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                letterSpacing: '0.12em',
                color: pct >= 100 ? goalReachedColor : 'var(--fs-ink)',
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                display: 'inline-block',
              }}
            >
              {glasses}/{goalGlasses}
            </span>
            <span
              aria-hidden="true"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.08em',
                color: 'var(--fs-muted)',
                fontWeight: 600,
              }}
            >
              כוסות
            </span>
          </span>
        </div>
        <div className="mt-2 fs-progress-track" style={{ height: 6 }}>
          <div
            ref={fillRef}
            className="fs-progress-fill"
            style={{
              height: '100%',
              width: 0,
              // Goal reached → 'good' (accent), not lime. The default
              // .fs-progress-fill is already accent, so this is a no-op visually
              // but makes the on-track semantics explicit and lime-free.
              background: pct >= 100 ? goalReachedColor : undefined,
            }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        {!isToday ? (
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              letterSpacing: '0.12em',
              color: 'var(--fs-muted)',
              alignSelf: 'center',
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
              <Plus size={16} style={{ color: 'var(--color-ink-on-accent)' }} aria-hidden="true" />
            </button>
            {/* Quick-add pills. A quick-add equal to the glass size duplicates the
                + button (two controls, one intent), so it is filtered out. */}
            {QUICK_ADD_AMOUNTS_ML.filter((amount) => amount !== glassMl).map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => handleQuickAdd(amount)}
                aria-label={`הוסף ${amount} מ״ל`}
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
                  borderRadius: 15,
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: 'var(--color-ink-on-accent)',
                }}
              >
                +{amount}
                <span style={{ marginInlineStart: 3, fontSize: '9px', opacity: 0.85 }}>מ״ל</span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
});
