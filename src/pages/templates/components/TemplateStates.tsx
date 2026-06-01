import { m } from 'framer-motion';
import { Trash2 } from 'lucide-react';

export function LoadingState() {
  return (
    <div className="pb-[88px]" dir="rtl">
      <div className="px-5 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="w-32 h-10 rounded-xl skeleton-shimmer" />
          <div className="w-11 h-11 rounded-xl skeleton-shimmer" />
        </div>

        {/* Cards */}
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <m.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="card p-5 h-[140px]"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl skeleton-shimmer" />
                <div className="flex-1 space-y-3">
                  <div className="w-48 h-5 rounded-lg skeleton-shimmer" />
                  <div className="w-32 h-4 rounded-lg skeleton-shimmer" />
                </div>
              </div>
            </m.div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="pb-[88px] flex flex-col items-center justify-center px-6" dir="rtl">
      <m.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-20 h-20 rounded-2xl bg-error/10 flex items-center justify-center mb-6"
      >
        <Trash2 size={32} className="text-error" />
      </m.div>
      <p className="mb-2 font-semibold" style={{ color: 'var(--fs-ink)', fontSize: '15px' }}>
        שגיאה בטעינה
      </p>
      <p className="mb-8 text-center" style={{ color: 'var(--fs-muted)', fontSize: '15px' }}>
        לא הצלחנו לטעון את התבניות. נסה שוב.
      </p>
      <m.button whileTap={{ scale: 0.95 }} onClick={onRetry} className="btn btn-primary">
        נסה שוב
      </m.button>
    </div>
  );
}
