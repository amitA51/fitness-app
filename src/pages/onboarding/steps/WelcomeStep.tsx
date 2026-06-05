import { m } from 'framer-motion';
import { Award, ChevronLeft, Target, TrendingUp } from 'lucide-react';
import { Button } from '../../../components/ui/Button';

export function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="w-full" style={{ color: 'var(--fs-ink)' }} dir="rtl">
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-8">
        {/* App Icon - FS Brand Mark */}
        <m.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
          className="w-28 h-28 flex items-center justify-center mb-6"
          style={{
            background: 'var(--fs-primary)',
            borderRadius: '22px 16px 22px 16px',
          }}
        >
          <span
            style={{
              fontFamily: '"Bricolage Grotesque", var(--font-display)',
              fontWeight: 800,
              fontSize: '56px',
              color: 'var(--fs-accent)',
              lineHeight: 1,
            }}
          >
            FS
          </span>
        </m.div>

        <m.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: '32px',
            color: 'var(--fs-ink)',
            letterSpacing: '-0.02em',
          }}
        >
          SparkOS
        </m.h1>

        <m.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '16px',
            color: 'var(--fs-muted)',
            marginTop: '8px',
          }}
        >
          אפליקציית הכושר שלך
        </m.p>

        <m.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: '14px',
            color: 'var(--fs-muted)',
            maxWidth: '280px',
            marginTop: '4px',
          }}
        >
          בואו נתחיל לבנות את תוכנית האימונים המושלמת עבורך
        </m.p>

        {/* Feature Highlights */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="flex gap-8 mt-12"
        >
          {[
            { icon: <Target size={22} />, label: 'יעדים' },
            { icon: <TrendingUp size={22} />, label: 'מעקב' },
            { icon: <Award size={22} />, label: 'שיאים' },
          ].map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-3">
              <div
                className="w-14 h-14 flex items-center justify-center"
                style={{
                  background: 'var(--fs-surface)',
                  border: '1px solid var(--fs-surface-2)',
                  borderRadius: 0,
                  color: 'var(--fs-accent)',
                }}
              >
                {item.icon}
              </div>
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '14px',
                  color: 'var(--fs-muted)',
                }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </m.div>
      </div>

      <m.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.75 }}
        className="px-6 pb-8 pt-4"
      >
        <Button variant="editorial" onClick={onNext} fullWidth style={{ minHeight: '56px' }}>
          בואו נתחיל
          {/* forward = left in RTL */}
          <ChevronLeft size={24} aria-hidden="true" />
        </Button>
      </m.div>
    </div>
  );
}
