import { m } from 'framer-motion';
import { memo, useEffect, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { getAllPRs } from '../../services/prService';
import type { PersonalRecord } from '../../types';

const isToday = (iso: string): boolean => {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

export const RecentPRBanner = memo(function RecentPRBanner() {
  const [recentPRs, setRecentPRs] = useState<PersonalRecord[]>([]);
  const reduced = useReducedMotion();

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const all = await getAllPRs();
        if (!mounted) return;
        const now = Date.now();
        const sevenDaysAgo = now - 7 * 86400000;
        const recent = all
          .filter((pr) => new Date(pr.date).getTime() >= sevenDaysAgo)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 3);
        setRecentPRs(recent);
      } catch {
        if (mounted) setRecentPRs([]);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (recentPRs.length === 0) return null;

  // A fresh PR earned today earns a single celebratory pulse on mount — not a
  // continuously breathing/blinking dot. Lime (--fs-signal) is legitimate here
  // (PR celebration). Older PRs in the 7-day window show a static dot.
  const earnedToday = recentPRs.some((pr) => isToday(pr.date));

  return (
    <div
      role="status"
      aria-label="שיאים אישיים חדשים"
      className="magnetic-card glass-surface fs-accent-rail signal-glow"
      style={{
        marginTop: 16,
        padding: '12px 16px',
        border: '1px solid var(--fs-surface-2)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 10,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            letterSpacing: '-0.01em',
            color: 'var(--fs-signal)',
            fontWeight: 600,
          }}
        >
          <m.span
            aria-hidden
            initial={reduced || !earnedToday ? false : { scale: 1 }}
            animate={reduced || !earnedToday ? undefined : { scale: [1, 1.2, 1] }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], times: [0, 0.5, 1] }}
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: 'var(--fs-signal)',
            }}
          />
          שיאים אישיים
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 8,
            letterSpacing: '-0.01em',
            color: 'var(--fs-muted)',
          }}
        >
          7 ימים
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {recentPRs.map((pr) => (
          <div
            key={pr.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '4px 0',
              borderBottom: '1px solid var(--fs-surface-2)',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--fs-ink)',
              }}
            >
              {pr.exerciseName}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 600,
                fontSize: 15,
                color: 'var(--fs-accent)',
                letterSpacing: '-0.01em',
              }}
            >
              <span className="kinetic-number" dir="ltr">
                {pr.weight}×{pr.reps}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 8,
                  fontWeight: 400,
                  color: 'var(--fs-muted)',
                  letterSpacing: '-0.01em',
                  marginInlineEnd: 4,
                }}
              >
                KG
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
