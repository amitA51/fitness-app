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
      style={{
        margin: '0 0 16px 0',
        padding: '12px 16px',
        border: '2px solid var(--mustard)',
        background: 'var(--bone-faint)',
      }}
    >
      <div
        style={{
          marginBottom: recentPRs.length > 0 ? 10 : 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--mustard-dark)',
        }}
      >
        <span>שיאים אישיים · 7 ימים</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {recentPRs.map((pr) => (
          <div
            key={pr.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-hebrew)',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--ink)',
              }}
            >
              {pr.exerciseName}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 18,
                color: 'var(--navy)',
                letterSpacing: '-0.01em',
              }}
            >
              {pr.weight}×{pr.reps}
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  fontWeight: 400,
                  color: 'var(--stone)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  marginRight: 6,
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
