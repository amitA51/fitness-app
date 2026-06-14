import { m } from 'framer-motion';
import { Award, ChevronLeft } from 'lucide-react';
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

        {/* Brand promise — same voice as the login Masthead ("כתוב סטים. תראה
            התקדמות.") rather than the generic "אפליקציית הכושר שלך". */}
        <m.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          style={{
            fontFamily: '"Bricolage Grotesque", var(--font-display)',
            fontWeight: 800,
            fontSize: '20px',
            color: 'var(--fs-ink)',
            letterSpacing: '-0.02em',
            marginTop: '8px',
          }}
        >
          כתבו סטים. ראו <span style={{ color: 'var(--fs-accent)' }}>התקדמות</span>.
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
            marginTop: '8px',
            lineHeight: 1.5,
          }}
        >
          רשמו כל אימון וצפו במשקלים, בנפח ובשיאים מטפסים עם הזמן.
        </m.p>

        {/* One concrete proof point instead of three vague chips — names the
            real mechanic (auto-detected PRs) rather than generic "מעקב/שיאים". */}
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="flex items-center gap-3 mt-12 px-4 py-3"
          style={{
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-surface-2)',
            borderRadius: '22px 16px 22px 16px',
            maxWidth: '320px',
          }}
        >
          <div
            className="w-10 h-10 flex items-center justify-center shrink-0"
            style={{ background: 'var(--fs-primary)', color: 'var(--fs-accent)', borderRadius: 0 }}
          >
            <Award size={20} aria-hidden="true" />
          </div>
          <span
            className="text-right"
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: '14px',
              color: 'var(--fs-ink)',
              lineHeight: 1.4,
            }}
          >
            שיא אישי חדש מזוהה אוטומטית בכל פעם שאתם משתפרים.
          </span>
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
