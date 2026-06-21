import { AnimatePresence, m } from 'framer-motion';
import { Activity, CloudOff, Heart, LayoutGrid, User } from 'lucide-react';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { showToast } from '../components/ui/GlobalToast';
import PageHeader from '../components/ui/PageHeader';
import {
  addBodyMeasurement,
  addBodyWeight,
  addRecoveryLog,
  calculateBMI,
  getBMICategory,
} from '../services/bodyStatsService';
import type { BodyMeasurement, RecoveryLog } from '../services/bodyStatsService';
import { todayStr } from '../utils/dateUtils';
import { triggerHapticEffect } from '../utils/haptics';
import { safeJsonParse } from '../utils/safeJson';
import { FadeIn } from '../components/motion/FadeIn';
import { ProgressSkeleton } from './progress/components/ProgressSkeleton';
import { AddMeasurementModal } from './progress/modals/AddMeasurementModal';
import { AddRecoveryModal } from './progress/modals/AddRecoveryModal';
import { AddWeightModal } from './progress/modals/AddWeightModal';
import { onlyCompleted } from './progress/progressMetrics';
import { BodyTab } from './progress/tabs/BodyTab';
import { OverviewTab } from './progress/tabs/OverviewTab';
import { RecoveryTab } from './progress/tabs/RecoveryTab';
import { WorkoutsTab } from './progress/tabs/WorkoutsTab';
import type { ProgressTab } from './progress/types';
import { useProgressData } from './progress/useProgressData';

// Four grouped sections (was six). Strength folds into Workouts; Weight +
// Measurements merge into Body. Each tab now owns a secondary segmented control
// where it needs one, so no single tab is an undifferentiated long scroll.
const TABS: { key: ProgressTab; label: string; icon: React.ReactNode }[] = [
  { key: 'overview', label: 'סקירה', icon: <LayoutGrid size={15} aria-hidden="true" /> },
  { key: 'workouts', label: 'אימונים', icon: <Activity size={15} aria-hidden="true" /> },
  { key: 'body', label: 'גוף', icon: <User size={15} aria-hidden="true" /> },
  { key: 'recovery', label: 'התאוששות', icon: <Heart size={15} aria-hidden="true" /> },
];

const motionProps = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
};

export default function ProgressPage() {
  // A forward navigation (e.g. finishing a workout) can request a starting tab
  // via location state; fall back to the overview for a normal visit.
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<ProgressTab>(() => {
    const requested = (location.state as { tab?: string } | null)?.tab;
    return TABS.some((t) => t.key === requested) ? (requested as ProgressTab) : 'overview';
  });
  const {
    sessions,
    prs,
    weightEntries,
    latestWeight,
    weightTrend,
    measurements,
    latestMeasurement,
    todayRecovery,
    recoveryScore,
    recoveryHistory,
    weeklyRecovery,
    isLoading,
    loadError,
    reload,
  } = useProgressData();
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await reload();
    } finally {
      setIsRetrying(false);
    }
  }, [reload]);

  const [showAddWeight, setShowAddWeight] = useState(false);
  const [showAddMeasurement, setShowAddMeasurement] = useState(false);
  const [showAddRecovery, setShowAddRecovery] = useState(false);
  const [userHeight] = useState(() => {
    try {
      const raw = localStorage.getItem('user_profile');
      if (!raw) return 175;
      const parsed = safeJsonParse<{ height?: number }>(raw);
      if (!parsed) return 175;
      return typeof parsed.height === 'number' && parsed.height > 0 ? parsed.height : 175;
    } catch {
      return 175;
    }
  });

  // Single status filter feeding every session-derived metric across the tabs.
  const completedSessions = useMemo(() => onlyCompleted(sessions), [sessions]);

  const bmi = useMemo(
    () => (latestWeight ? calculateBMI(latestWeight.weight, userHeight) : null),
    [latestWeight, userHeight]
  );
  const bmiCategory = useMemo(() => (bmi ? getBMICategory(bmi) : null), [bmi]);

  const handleShowAddWeight = useCallback(() => setShowAddWeight(true), []);
  const handleShowAddMeasurement = useCallback(() => setShowAddMeasurement(true), []);
  const handleShowAddRecovery = useCallback(() => setShowAddRecovery(true), []);
  const handleCloseAddWeight = useCallback(() => setShowAddWeight(false), []);
  const handleCloseAddMeasurement = useCallback(() => setShowAddMeasurement(false), []);
  const handleCloseAddRecovery = useCallback(() => setShowAddRecovery(false), []);

  const handleSaveWeight = useCallback(
    async (weight: number, notes: string) => {
      await addBodyWeight({ date: todayStr(), weight, notes });
      triggerHapticEffect('success');
      setShowAddWeight(false);
      reload();
    },
    [reload]
  );
  const handleSaveMeasurement = useCallback(
    async (m: Omit<BodyMeasurement, 'id' | 'createdAt'>) => {
      // Catch here (not in the modal): a thrown save previously surfaced as an
      // unhandled rejection with a stuck-open sheet and zero user feedback.
      try {
        await addBodyMeasurement(m);
        triggerHapticEffect('success');
        setShowAddMeasurement(false);
        reload();
      } catch {
        showToast('שמירת ההיקפים נכשלה. נסו שוב.', { variant: 'error' });
      }
    },
    [reload]
  );
  const handleSaveRecovery = useCallback(
    async (r: Omit<RecoveryLog, 'id' | 'createdAt'>) => {
      try {
        await addRecoveryLog(r);
        triggerHapticEffect('success');
        setShowAddRecovery(false);
        reload();
      } catch {
        showToast('שמירת דיווח ההתאוששות נכשלה. נסו שוב.', { variant: 'error' });
      }
    },
    [reload]
  );

  const todayLabel = useMemo(
    () =>
      new Date().toLocaleDateString('he-IL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    []
  );

  return (
    <div
      className="ambient-mesh ambient-mesh-soft pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))]"
      style={{ background: 'var(--fs-bg)' }}
      dir="rtl"
    >
      {/* Header — shared PageHeader SSOT (flattens the old bespoke masthead to the
          standard 26px title + 2px accent divider for cross-tab consistency). The
          date kicker becomes the eyebrow; its numbers render dir="ltr". */}
      <PageHeader
        title="התקדמות"
        eyebrow={<span dir="ltr">{todayLabel}</span>}
      />

      {/* Editorial Tab Bar — four primary sections */}
      <FadeIn className="px-5 pt-4 pb-2">
        <div
          className="flex gap-1 overflow-x-auto"
          style={{
            borderBottom: '1px solid var(--fs-surface-2)',
            gap: 0,
            scrollbarWidth: 'none',
          }}
          role="tablist"
          aria-label="התקדמות"
        >
          {TABS.map((tab, idx) => (
            <button
              type="button"
              key={tab.key}
              role="tab"
              id={`progress-tab-${tab.key}`}
              aria-selected={activeTab === tab.key}
              aria-controls={`progress-panel-${tab.key}`}
              tabIndex={activeTab === tab.key ? 0 : -1}
              onClick={() => setActiveTab(tab.key)}
              className="active:scale-[0.97] motion-reduce:active:scale-100"
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  e.preventDefault();
                  const next = TABS[(idx + 1) % TABS.length];
                  if (!next) return;
                  setActiveTab(next.key);
                  document.getElementById(`progress-tab-${next.key}`)?.focus();
                } else if (e.key === 'ArrowLeft') {
                  e.preventDefault();
                  const prev = TABS[(idx - 1 + TABS.length) % TABS.length];
                  if (!prev) return;
                  setActiveTab(prev.key);
                  document.getElementById(`progress-tab-${prev.key}`)?.focus();
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '10px 14px',
                minHeight: 44,
                flex: 1,
                justifyContent: 'center',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.08em',
                fontWeight: activeTab === tab.key ? 700 : 400,
                color: activeTab === tab.key ? 'var(--fs-ink)' : 'var(--fs-muted)',
                background: 'none',
                border: 'none',
                borderBottom:
                  activeTab === tab.key ? '2px solid var(--fs-accent)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'color 0.15s, border-color 0.15s, transform 0.1s',
                textTransform: 'uppercase',
                marginBottom: -1,
                whiteSpace: 'nowrap',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </FadeIn>

      {/* Tab Content — exactly ONE logical section visible at a time */}
      <div className="px-5">
        {isLoading ? (
          <ProgressSkeleton />
        ) : loadError ? (
          // Explicit load-failure state. Without it, users WITH data saw the
          // "complete your first workout" empty state after a failed load.
          <div
            style={{
              background: 'var(--fs-surface)',
              borderRadius: '22px 16px 22px 16px',
              border: '1px solid var(--fs-surface-2)',
              padding: 16,
              marginTop: 16,
            }}
          >
            <div className="flex flex-col items-center py-10 text-center gap-3">
              <CloudOff size={32} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />
              <p style={{ fontSize: 14, color: 'var(--fs-muted)', margin: 0 }}>
                טעינת נתוני ההתקדמות נכשלה
              </p>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="btn-primary"
                style={{ minHeight: 44, opacity: isRetrying ? 0.6 : 1 }}
              >
                {isRetrying ? 'טוען…' : 'נסו שוב'}
              </button>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="sync">
            {activeTab === 'overview' && (
              <m.div
                key="overview"
                id="progress-panel-overview"
                role="tabpanel"
                aria-labelledby="progress-tab-overview"
                {...motionProps}
              >
                <OverviewTab sessions={completedSessions} prs={prs} />
              </m.div>
            )}
            {activeTab === 'workouts' && (
              <m.div
                key="workouts"
                id="progress-panel-workouts"
                role="tabpanel"
                aria-labelledby="progress-tab-workouts"
                {...motionProps}
              >
                <WorkoutsTab sessions={completedSessions} prs={prs} isLoading={isLoading} />
              </m.div>
            )}
            {activeTab === 'body' && (
              <m.div
                key="body"
                id="progress-panel-body"
                role="tabpanel"
                aria-labelledby="progress-tab-body"
                {...motionProps}
              >
                <BodyTab
                  latestWeight={latestWeight}
                  weightTrend={weightTrend}
                  bmi={bmi}
                  bmiCategory={bmiCategory}
                  weightEntries={weightEntries}
                  latestMeasurement={latestMeasurement}
                  measurements={measurements}
                  onAddWeight={handleShowAddWeight}
                  onAddMeasurement={handleShowAddMeasurement}
                />
              </m.div>
            )}
            {activeTab === 'recovery' && (
              <m.div
                key="recovery"
                id="progress-panel-recovery"
                role="tabpanel"
                aria-labelledby="progress-tab-recovery"
                {...motionProps}
              >
                <RecoveryTab
                  todayRecovery={todayRecovery}
                  recoveryScore={recoveryScore}
                  weeklyRecovery={weeklyRecovery}
                  history={recoveryHistory}
                  onAdd={handleShowAddRecovery}
                />
              </m.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Add sheets — always mounted; <Sheet> owns open/close animation. */}
      <AddWeightModal
        isOpen={showAddWeight}
        onSave={handleSaveWeight}
        onClose={handleCloseAddWeight}
      />
      <AddMeasurementModal
        isOpen={showAddMeasurement}
        onSave={handleSaveMeasurement}
        onClose={handleCloseAddMeasurement}
        latest={latestMeasurement}
      />
      <AddRecoveryModal
        isOpen={showAddRecovery}
        onSave={handleSaveRecovery}
        onClose={handleCloseAddRecovery}
      />
    </div>
  );
}
