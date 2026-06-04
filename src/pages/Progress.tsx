import { AnimatePresence, m } from 'framer-motion';
import { Activity, Heart, LayoutGrid, User } from 'lucide-react';
import type React from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  addBodyMeasurement,
  addBodyWeight,
  addRecoveryLog,
  calculateBMI,
  getBMICategory,
} from '../services/bodyStatsService';
import type { BodyMeasurement, RecoveryLog } from '../services/bodyStatsService';
import { todayStr } from '../utils/dateUtils';
import { safeJsonParse } from '../utils/safeJson';
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
  { key: 'recovery', label: 'ריקאברי', icon: <Heart size={15} aria-hidden="true" /> },
];

const motionProps = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2 },
};

export default function ProgressPage() {
  const [activeTab, setActiveTab] = useState<ProgressTab>('overview');
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
    reload,
  } = useProgressData();

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
      setShowAddWeight(false);
      reload();
    },
    [reload]
  );
  const handleSaveMeasurement = useCallback(
    async (m: Omit<BodyMeasurement, 'id' | 'createdAt'>) => {
      await addBodyMeasurement(m);
      setShowAddMeasurement(false);
      reload();
    },
    [reload]
  );
  const handleSaveRecovery = useCallback(
    async (r: Omit<RecoveryLog, 'id' | 'createdAt'>) => {
      await addRecoveryLog(r);
      setShowAddRecovery(false);
      reload();
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
      {/* Header */}
      <header
        className="masthead sticky top-0 z-20"
        style={{
          paddingTop: 'max(20px, env(safe-area-inset-top, 20px))',
          background: 'var(--fs-bg)',
        }}
      >
        <div
          className="kicker"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.22em',
            color: 'var(--fs-accent-2)',
            textTransform: 'uppercase',
          }}
        >
          {todayLabel}
        </div>
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 800,
            fontSize: 'clamp(44px, 12vw, 72px)',
            lineHeight: 0.9,
            marginTop: '8px',
            color: 'var(--fs-ink)',
          }}
        >
          התקדמות
        </h1>
      </header>

      {/* Editorial Tab Bar — four primary sections */}
      <div className="px-5 pt-4 pb-2">
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
                transition: 'color 0.15s, border-color 0.15s',
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
      </div>

      {/* Tab Content — exactly ONE logical section visible at a time */}
      <div className="px-5">
        {isLoading ? (
          <ProgressSkeleton />
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
