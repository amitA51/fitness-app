import { memo, useEffect, useState } from 'react';
import { getAllPRs } from '../../services/prService';
import type { PersonalRecord } from '../../types';

export const RecentPRBanner = memo(function RecentPRBanner() {
  const [recentPRs, setRecentPRs] = useState<PersonalRecord[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const all = await getAllPRs();
        const now = Date.now();
        const sevenDaysAgo = now - 7 * 86400000;
        const recent = all
          .filter((pr) => new Date(pr.date).getTime() >= sevenDaysAgo)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 3);
        setRecentPRs(recent);
      } catch {
        setRecentPRs([]);
      }
    }
    load();
  }, []);

  if (recentPRs.length === 0) return null;

  return (
    <div
      role="status"
      aria-label="שיאים אישיים חדשים"
      className="magnetic-card glass-surface fs-accent-rail signal-glow"
      style={{
        marginTop: 16,
        padding: '12px 16px',
        border: '1px solid var(--fs-surface-2)',
        borderRadius: '22px 16px 22px 16px',
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
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--fs-signal)',
            fontWeight: 600,
          }}
        >
          <span className="breathing-dot signal" aria-hidden />
          שיאים אישיים
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 8,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
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
              <span className="kinetic-number">
                {pr.weight}×{pr.reps}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 8,
                  fontWeight: 400,
                  color: 'var(--fs-muted)',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
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
