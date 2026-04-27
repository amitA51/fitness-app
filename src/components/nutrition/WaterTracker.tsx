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
        border: '2px solid var(--navy)',
        background: 'var(--bone-faint)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <Droplets size={20} style={{ color: 'var(--navy)', flexShrink: 0 }} aria-hidden="true" />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span
            style={{
              fontFamily: 'var(--font-hebrew)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--ink)',
            }}
          >
            שתייה
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.16em',
              color: pct >= 100 ? 'var(--color-success)' : 'var(--stone)',
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
            background: 'var(--bone-deep)',
            overflow: 'hidden',
          }}
        >
          <motion.div
            style={{
              height: '100%',
              background: pct >= 100 ? 'var(--color-success)' : 'var(--navy)',
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
            background: 'var(--bone-deep)',
            border: 'none',
            cursor: totalMl <= 0 ? 'not-allowed' : 'pointer',
            opacity: totalMl <= 0 ? 0.4 : 1,
          }}
        >
          <Minus size={14} style={{ color: 'var(--navy)' }} />
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
            background: 'var(--navy)',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <Plus size={14} style={{ color: 'var(--mustard)' }} />
        </button>
      </div>
    </div>
  );
});
