import { motion } from 'framer-motion';
import { Droplets, Minus, Plus } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import {
  addWaterEntry,
  getGlassSize,
  getTodayWaterTotal,
  getWaterGoal,
} from '../../services/waterService';

export const WaterTracker = memo(function WaterTracker() {
  const [totalMl, setTotalMl] = useState(0);
  const goalMl = getWaterGoal();
  const glassMl = getGlassSize();

  const loadTotal = useCallback(async () => {
    const t = await getTodayWaterTotal();
    setTotalMl(t);
  }, []);

  useEffect(() => {
    loadTotal();
  }, [loadTotal]);

  const pct = Math.min(Math.round((totalMl / goalMl) * 100), 100);
  const glasses = Math.round(totalMl / glassMl);
  const goalGlasses = Math.round(goalMl / glassMl);

  const handleAdd = useCallback(async () => {
    await addWaterEntry(glassMl);
    setTotalMl((prev) => prev + glassMl);
  }, [glassMl]);

  const handleRemove = useCallback(async () => {
    if (totalMl <= 0) return;
    await addWaterEntry(-glassMl);
    setTotalMl((prev) => Math.max(0, prev - glassMl));
  }, [glassMl, totalMl]);

  return (
    <div
      role="region"
      aria-label="מעקב שתייה"
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
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.16em',
              color: pct >= 100 ? 'var(--fs-accent)' : 'var(--fs-muted)',
              textTransform: 'uppercase',
            }}
          >
            {glasses}/{goalGlasses} glasses
          </span>
        </div>
        <div
          className="mt-2"
          style={{
            height: 6,
            background: 'var(--fs-surface-2)',
            overflow: 'hidden',
          }}
        >
          <motion.div
            style={{
              height: '100%',
              background: pct >= 100 ? 'var(--fs-signal)' : 'var(--fs-accent)',
            }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button
          type="button"
          onClick={handleRemove}
          disabled={totalMl <= 0}
          aria-label="הסר כוס"
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--fs-surface-2)',
            border: 'none',
            cursor: totalMl <= 0 ? 'not-allowed' : 'pointer',
            opacity: totalMl <= 0 ? 0.4 : 1,
          }}
        >
          <Minus size={14} style={{ color: 'var(--fs-primary)' }} />
        </button>
        <button
          type="button"
          onClick={handleAdd}
          aria-label="הוסף כוס"
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--fs-accent)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} style={{ color: 'var(--fs-primary)' }} />
        </button>
        {/* Quick water buttons: +250ml pill */}
        <button
          type="button"
          onClick={async () => {
            await addWaterEntry(250);
            setTotalMl((prev) => prev + 250);
          }}
          aria-label="הוסף 250 מ״ל"
          style={{
            padding: '0 10px',
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--fs-accent)',
            border: 'none',
            cursor: 'pointer',
            borderRadius: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--fs-primary)',
            gap: 3,
          }}
        >
          +250
        </button>
        <button
          type="button"
          onClick={async () => {
            await addWaterEntry(500);
            setTotalMl((prev) => prev + 500);
          }}
          aria-label="הוסף 500 מ״ל"
          style={{
            padding: '0 10px',
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--fs-accent)',
            border: 'none',
            cursor: 'pointer',
            borderRadius: 0,
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--fs-primary)',
            gap: 3,
          }}
        >
          +500
        </button>
      </div>
    </div>
  );
});
