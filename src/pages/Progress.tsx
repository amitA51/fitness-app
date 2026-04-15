import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scale, TrendingUp, TrendingDown, Minus, Activity, Moon, Battery,
  Plus, X, Heart, Ruler, BarChart3,
} from 'lucide-react';
import {
  addBodyWeight, getBodyWeightsByDateRange, getLatestWeight, calculateWeightTrend, calculateBMI, getBMICategory,
  addBodyMeasurement, getBodyMeasurementsByDateRange, getLatestMeasurement,
  addRecoveryLog, getRecoveryLogsByDateRange, getTodayRecoveryLog, getLegacyRecoveryScore, getWeeklyRecoveryAverage,
  TIGHTNESS_AREAS,
} from '../services/bodyStatsService';
import type { BodyWeightEntry, BodyMeasurement, RecoveryLog, WeightTrend } from '../services/bodyStatsService';

type ProgressTab = 'weight' | 'measurements' | 'recovery';

const TABS: { key: ProgressTab; label: string; icon: React.ReactNode }[] = [
  { key: 'weight', label: 'משקל', icon: <Scale size={15} /> },
  { key: 'measurements', label: 'מדידות', icon: <Ruler size={15} /> },
  { key: 'recovery', label: 'ריקאברי', icon: <Heart size={15} /> },
];

export default function ProgressPage() {
  const [activeTab, setActiveTab] = useState<ProgressTab>('weight');
  const [weightEntries, setWeightEntries] = useState<BodyWeightEntry[]>([]);
  const [latestWeight, setLatestWeight] = useState<BodyWeightEntry | null>(null);
  const [weightTrend, setWeightTrend] = useState<WeightTrend | null>(null);
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([]);
  const [latestMeasurement, setLatestMeasurement] = useState<BodyMeasurement | null>(null);
  const [todayRecovery, setTodayRecovery] = useState<RecoveryLog | null>(null);
  const [recoveryScore, setRecoveryScore] = useState<ReturnType<typeof getLegacyRecoveryScore> | null>(null);
  const [weeklyRecovery, setWeeklyRecovery] = useState({ avgSleep: 0, avgEnergy: 0, avgSoreness: 0, avgStress: 0, avgScore: 0 });
  const [showAddWeight, setShowAddWeight] = useState(false);
  const [showAddMeasurement, setShowAddMeasurement] = useState(false);
  const [showAddRecovery, setShowAddRecovery] = useState(false);
  const [userHeight] = useState(() => {
    try {
      const raw = localStorage.getItem('user_profile');
      if (!raw) return 175;
      const parsed = JSON.parse(raw);
      return typeof parsed.height === 'number' && parsed.height > 0 ? parsed.height : 175;
    } catch { return 175; }
  });

  const loadData = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    
    // Parallel data loading for better performance
    const [weights, latest, meas, latestMeas, rec, weekly] = await Promise.all([
      getBodyWeightsByDateRange(monthAgo, today),
      getLatestWeight(),
      getBodyMeasurementsByDateRange(monthAgo, today),
      getLatestMeasurement(),
      getTodayRecoveryLog(),
      getWeeklyRecoveryAverage(),
    ]);
    
    setWeightEntries(weights);
    setLatestWeight(latest);
    if (weights.length >= 2) setWeightTrend(calculateWeightTrend(weights));
    setMeasurements(meas);
    setLatestMeasurement(latestMeas);
    setTodayRecovery(rec);
    if (rec) setRecoveryScore(getLegacyRecoveryScore(rec));
    setWeeklyRecovery(weekly);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const bmi = latestWeight ? calculateBMI(latestWeight.weight, userHeight) : null;
  const bmiCategory = bmi ? getBMICategory(bmi) : null;

  return (
    <div className="min-h-screen bg-black pb-28" dir="rtl">
      <div className="h-safe-top" />

      {/* Header */}
      <header className="px-5 pt-6 pb-5">
        <h1 className="font-condensed font-bold text-[var(--color-primary)] text-4xl leading-none tracking-wide">
          התקדמות
        </h1>
        <p className="text-[#8E8E93] text-sm mt-1">
          {new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </header>

      {/* Pill Tab Bar */}
      <div className="px-4 mb-5">
        <div className="flex gap-2 p-1 bg-white/[0.06] rounded-2xl">
          {TABS.map(tab => (
            <button 
              key={tab.key} 
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.key ? 'bg-[var(--color-primary)] text-white shadow-lg' : 'text-[#8E8E93]'
              }`}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4">
        <AnimatePresence mode="sync">
          {activeTab === 'weight' && (
            <motion.div key="weight" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <WeightTab latestWeight={latestWeight} weightTrend={weightTrend} bmi={bmi} bmiCategory={bmiCategory} weightEntries={weightEntries} onAdd={() => setShowAddWeight(true)} />
            </motion.div>
          )}
          {activeTab === 'measurements' && (
            <motion.div key="measurements" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <MeasurementsTab latestMeasurement={latestMeasurement} measurements={measurements} onAdd={() => setShowAddMeasurement(true)} />
            </motion.div>
          )}
          {activeTab === 'recovery' && (
            <motion.div key="recovery" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              <RecoveryTab todayRecovery={todayRecovery} recoveryScore={recoveryScore} weeklyRecovery={weeklyRecovery} onAdd={() => setShowAddRecovery(true)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showAddWeight && <AddWeightModal onSave={async (weight, notes) => { await addBodyWeight({ date: new Date().toISOString().split('T')[0], weight, notes }); setShowAddWeight(false); loadData(); }} onClose={() => setShowAddWeight(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showAddMeasurement && <AddMeasurementModal onSave={async (m) => { await addBodyMeasurement(m); setShowAddMeasurement(false); loadData(); }} onClose={() => setShowAddMeasurement(false)} latest={latestMeasurement} />}
      </AnimatePresence>
      <AnimatePresence>
        {showAddRecovery && <AddRecoveryModal onSave={async (r) => { await addRecoveryLog(r); setShowAddRecovery(false); loadData(); }} onClose={() => setShowAddRecovery(false)} />}
      </AnimatePresence>
    </div>
  );
}

function WeightTab({ latestWeight, weightTrend, bmi, bmiCategory, weightEntries, onAdd }: {
  latestWeight: BodyWeightEntry | null; weightTrend: WeightTrend | null; bmi: number | null;
  bmiCategory: { label: string; color: string } | null; weightEntries: BodyWeightEntry[]; onAdd: () => void;
}) {
  const last7 = weightEntries.slice(-7);
  const maxW = useMemo(() => Math.max(...last7.map(w => w.weight), 1), [last7]);
  const minW = useMemo(() => Math.min(...last7.map(w => w.weight)), [last7]);
  const range = maxW - minW || 1;

  return (
    <div className="space-y-4">
      {/* Hero stat card */}
      <div className="bg-[#111111] rounded-[20px] border border-white/[0.06] p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[#8E8E93] text-xs font-medium mb-1">משקל נוכחי</p>
            {latestWeight ? (
              <div className="flex items-end gap-2">
                <span className="text-[52px] font-black text-white leading-none">{latestWeight.weight}</span>
                <span className="text-xl text-[#8E8E93] mb-1.5 font-medium">ק״ג</span>
              </div>
            ) : (
              <span className="text-[52px] font-black text-white/20 leading-none">—</span>
            )}
          </div>
          {bmi && bmiCategory && (
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-[#8E8E93] text-xs">BMI</span>
              <span className="text-2xl font-black" style={{ color: bmiCategory.color }}>{bmi}</span>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ color: bmiCategory.color, backgroundColor: `${bmiCategory.color}20` }}>{bmiCategory.label}</span>
            </div>
          )}
        </div>

        {weightTrend && (
          <div className="flex items-center gap-2 py-3 px-4 bg-white/[0.04] rounded-2xl">
            {weightTrend.direction === 'עלייה' && <TrendingUp size={18} className="text-[#FF453A]" />}
            {weightTrend.direction === 'ירידה' && <TrendingDown size={18} className="text-[#30D158]" />}
            {weightTrend.direction === 'יציב' && <Minus size={18} className="text-[#8E8E93]" />}
            <span className="text-sm font-semibold" style={{
              color: weightTrend.direction === 'ירידה' ? '#30D158' : weightTrend.direction === 'עלייה' ? '#FF453A' : '#8E8E93'
            }}>
              {weightTrend.direction} {weightTrend.change > 0 ? '+' : ''}{weightTrend.change} ק״ג
            </span>
            <span className="text-[11px] text-[#8E8E93] mr-auto">30 יום אחרונים</span>
          </div>
        )}

        {!latestWeight && (
          <div className="flex flex-col items-center py-6 text-center">
            <Scale size={36} className="text-[#8E8E93] mb-3" />
            <p className="text-[#8E8E93] text-sm mb-4">עדיין לא תיעדת משקל</p>
            <motion.button onClick={onAdd} className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-2xl font-semibold text-sm" whileTap={{ scale: 0.95 }}>
              הוסף משקל ראשון
            </motion.button>
          </div>
        )}
      </div>

      {/* 7-bar chart */}
      {last7.length > 1 && (
        <div className="bg-[#111111] rounded-[20px] border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-white text-sm">מגמת 7 ימים</h3>
            <BarChart3 size={16} className="text-[#8E8E93]" />
          </div>
          <div className="h-32 flex items-end gap-2">
            {last7.map((entry, i) => {
              const heightPct = ((entry.weight - minW) / range) * 65 + 20;
              const isLast = i === last7.length - 1;
              return (
                <div key={entry.id} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-[9px] text-[#8E8E93]">{entry.weight}</span>
                  <motion.div
                    className="w-full rounded-t-lg"
                    style={{ backgroundColor: isLast ? 'var(--color-primary)' : 'rgba(255,255,255,0.12)' }}
                    initial={{ height: 0 }}
                    animate={{ height: `${heightPct}%` }}
                    transition={{ delay: i * 0.06, duration: 0.5, ease: 'easeOut' }}
                  />
                  <span className="text-[9px] text-[#8E8E93]">
                    {new Date(entry.date).toLocaleDateString('he-IL', { day: 'numeric' })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add weight button */}
      {latestWeight && (
        <motion.button onClick={onAdd}
          className="w-full py-4 rounded-2xl bg-[var(--color-primary)] text-white font-bold text-base flex items-center justify-center gap-2"
          whileTap={{ scale: 0.98 }}>
          <Plus size={20} />הוסף משקל
        </motion.button>
      )}
    </div>
  );
}

function MeasurementsTab({ latestMeasurement, measurements, onAdd }: { latestMeasurement: BodyMeasurement | null; measurements: BodyMeasurement[]; onAdd: () => void }) {
  const measurementLabels: Record<string, string> = {
    chest: 'חזה', waist: 'מותניים', hips: 'אגן', arms: 'זרועות', thighs: 'ירכיים', neck: 'צוואר',
  };
  const prev = measurements.length > 1 ? measurements[measurements.length - 2] : null;

  return (
    <div className="space-y-4">
      <div className="bg-[#111111] rounded-[20px] border border-white/[0.06] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[#8E8E93] text-xs mb-0.5">מדידות גוף</p>
            <h2 className="font-bold text-white text-sm">עדכון אחרון</h2>
          </div>
          <motion.button onClick={onAdd} className="flex items-center gap-1.5 px-4 py-2.5 bg-[var(--color-primary)] rounded-2xl text-sm text-white font-semibold" whileTap={{ scale: 0.95 }}>
            <Plus size={15} />עדכן
          </motion.button>
        </div>

        {latestMeasurement ? (
          <div className="space-y-2">
            {Object.entries(measurementLabels).map(([key, label]) => {
              const curr = latestMeasurement[key as keyof BodyMeasurement] as number | undefined;
              const prevVal = prev?.[key as keyof BodyMeasurement] as number | undefined;
              const diff = curr && prevVal ? +(curr - prevVal).toFixed(1) : null;
              return (
                <div key={key} className="flex items-center justify-between py-3 px-4 bg-white/[0.04] rounded-2xl">
                  <span className="text-[#8E8E93] text-sm">{label}</span>
                  <div className="flex items-center gap-3">
                    {diff !== null && diff !== 0 && (
                      <span className="text-xs font-semibold" style={{ color: diff < 0 ? '#30D158' : '#FF453A' }}>
                        {diff > 0 ? '+' : ''}{diff}
                      </span>
                    )}
                    <span className="text-white font-bold text-sm">{curr ? `${curr} ס״מ` : '—'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 text-center">
            <Ruler size={36} className="text-[#8E8E93] mb-3" />
            <p className="text-[#8E8E93] text-sm mb-5">עדיין לא תיעדת מידות</p>
            <motion.button onClick={onAdd} className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-2xl font-semibold text-sm" whileTap={{ scale: 0.95 }}>הוסף מידות ראשונות</motion.button>
          </div>
        )}
      </div>

      {latestMeasurement && (
        <motion.button onClick={onAdd}
          className="w-full py-4 rounded-2xl bg-[var(--color-primary)] text-white font-bold text-base flex items-center justify-center gap-2"
          whileTap={{ scale: 0.98 }}>
          <Plus size={20} />הוסף מדידה
        </motion.button>
      )}
    </div>
  );
}

function RecoveryTab({ todayRecovery, recoveryScore, weeklyRecovery, onAdd }: {
  todayRecovery: RecoveryLog | null; recoveryScore: ReturnType<typeof getLegacyRecoveryScore> | null;
  weeklyRecovery: { avgSleep: number; avgEnergy: number; avgSoreness: number; avgStress: number; avgScore: number };
  onAdd: () => void;
}) {
  const [history, setHistory] = useState<RecoveryLog[]>([]);
  useEffect(() => {
    const load = async () => {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      const logs = await getRecoveryLogsByDateRange(weekAgo, today);
      setHistory(logs);
    };
    load();
  }, []);

  const scoreColor = recoveryScore?.color ?? '#8E8E93';
  const scorePct = recoveryScore ? recoveryScore.score : 0;

  return (
    <div className="space-y-4">
      {/* Recovery score */}
      <div className="bg-[#111111] rounded-[20px] border border-white/[0.06] p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[#8E8E93] text-xs mb-0.5">ציון ריקאברי</p>
            <h2 className="font-bold text-white text-sm">היום</h2>
          </div>
          <motion.button onClick={onAdd} className="flex items-center gap-1.5 px-4 py-2.5 bg-[var(--color-primary)] rounded-2xl text-sm text-white font-semibold" whileTap={{ scale: 0.95 }}>
            <Plus size={15} />עדכן
          </motion.button>
        </div>

        {recoveryScore ? (
          <div>
            <div className="flex items-center gap-6 mb-5">
              {/* CSS circle score */}
              <div className="relative w-28 h-28 flex-shrink-0 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-white/[0.06]" />
                <div className="absolute inset-2 rounded-full" style={{ backgroundColor: `${scoreColor}18` }} />
                <div className="relative z-10 text-center">
                  <div className="text-3xl font-black leading-none" style={{ color: scoreColor }}>{recoveryScore.score}</div>
                  <div className="text-[10px] text-[#8E8E93] mt-1">{recoveryScore.label}</div>
                </div>
                {/* Arc indicator */}
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 112 112">
                  <circle cx="56" cy="56" r="50" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                  <motion.circle cx="56" cy="56" r="50" fill="none" stroke={scoreColor} strokeWidth="6" strokeLinecap="round"
                    strokeDasharray={`${scorePct * 3.14} ${314 - scorePct * 3.14}`}
                    initial={{ strokeDasharray: '0 314' }}
                    animate={{ strokeDasharray: `${scorePct * 3.14} ${314 - scorePct * 3.14}` }}
                    transition={{ duration: 1.2, ease: 'easeOut' }} />
                </svg>
              </div>

              <div className="flex-1 space-y-3">
                <RecoveryBar label="שינה" value={recoveryScore.sleepScore} max={25} color="#BF5AF2" />
                <RecoveryBar label="כאב" value={recoveryScore.sorenessScore} max={25} color="#FF9F0A" />
                <RecoveryBar label="אנרגיה" value={recoveryScore.energyScore} max={25} color="#30D158" />
                <RecoveryBar label="לחץ" value={recoveryScore.stressScore} max={25} color="#0A84FF" />
              </div>
            </div>

            {todayRecovery && todayRecovery.tightAreas && todayRecovery.tightAreas.length > 0 && (
              <div className="pt-4 border-t border-white/[0.06]">
                <p className="text-[11px] text-[#8E8E93] mb-2">אזורים תפוסים</p>
                <div className="flex flex-wrap gap-2">
                  {todayRecovery.tightAreas.map(area => (
                    <span key={area} className="px-3 py-1.5 rounded-full bg-[var(--color-primary)]/15 text-[var(--color-primary)] text-xs font-semibold border border-[var(--color-primary)]/20">{area}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center py-10 text-center">
            <Heart size={36} className="text-[#8E8E93] mb-3" />
            <p className="text-[#8E8E93] text-sm mb-5">עדיין לא דיווחת על ההתאוששות שלך</p>
            <motion.button onClick={onAdd} className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-2xl font-semibold text-sm" whileTap={{ scale: 0.95 }}>התחל דיווח</motion.button>
          </div>
        )}
      </div>

      {/* Weekly avg */}
      {weeklyRecovery.avgScore > 0 && (
        <div className="bg-[#111111] rounded-[20px] border border-white/[0.06] p-5">
          <h3 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
            <Activity size={15} className="text-[var(--color-primary)]" />ממוצע שבועי
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/[0.04] rounded-2xl p-4 text-center">
              <Moon size={18} className="text-[#BF5AF2] mx-auto mb-2" />
              <div className="text-xl font-black text-white">{weeklyRecovery.avgSleep}ש</div>
              <div className="text-[11px] text-[#8E8E93] mt-0.5">שינה ממוצעת</div>
            </div>
            <div className="bg-white/[0.04] rounded-2xl p-4 text-center">
              <Battery size={18} className="text-[#30D158] mx-auto mb-2" />
              <div className="text-xl font-black text-white">{weeklyRecovery.avgEnergy}/10</div>
              <div className="text-[11px] text-[#8E8E93] mt-0.5">אנרגיה ממוצעת</div>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="bg-[#111111] rounded-[20px] border border-white/[0.06] p-5">
          <h3 className="font-bold text-white text-sm mb-3">היסטוריית ריקאברי</h3>
          <div className="space-y-1">
            {history.slice().reverse().slice(0, 7).map(log => {
              const score = getLegacyRecoveryScore(log);
              return (
                <div key={log.id} className="flex items-center justify-between py-2.5 border-b border-white/[0.06] last:border-0">
                  <span className="text-[#8E8E93] text-sm">{new Date(log.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: score.color }}>{score.label}</span>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm" style={{ backgroundColor: `${score.color}18`, color: score.color }}>{score.score}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RecoveryBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-[#8E8E93]">{label}</span>
        <span className="font-semibold" style={{ color }}>{value}/{max}</span>
      </div>
      <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
        <motion.div className="h-full rounded-full" style={{ backgroundColor: color }} initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
      </div>
    </div>
  );
}

function AddWeightModal({ onSave, onClose }: { onSave: (weight: number, notes: string) => Promise<void>; onClose: () => void }) {
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-lg bg-[#1C1C1E] rounded-t-[28px] p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">עדכון משקל</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.1] flex items-center justify-center text-[#8E8E93]"><X size={17} /></button>
        </div>
        <div className="space-y-5">
          <div className="text-center py-4">
            <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="0.0"
              className="w-36 text-center bg-transparent text-white font-black text-6xl border-b-2 border-[var(--color-primary)] focus:outline-none"
              step="0.1" inputMode="decimal" />
            <div className="text-lg text-[#8E8E93] mt-2 font-medium">ק״ג</div>
          </div>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="הערות (אופציונלי)"
            className="w-full bg-[#2C2C2E] rounded-[14px] py-3.5 px-4 text-white text-sm placeholder-[#8E8E93] outline-none focus:ring-1 focus:ring-[var(--color-primary)]/40" />
          <motion.button
            onClick={async () => { if (!weight) return; setSaving(true); await onSave(parseFloat(weight), notes); setSaving(false); }}
            disabled={!weight || saving}
            className="w-full py-4 rounded-2xl bg-[var(--color-primary)] text-white font-bold text-base disabled:opacity-40"
            whileTap={{ scale: weight ? 0.98 : 1 }}>
            שמור
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AddMeasurementModal({ onSave, onClose, latest }: { onSave: (m: Omit<BodyMeasurement, 'id' | 'createdAt'>) => Promise<void>; onClose: () => void; latest: BodyMeasurement | null }) {
  const [chest, setChest] = useState(latest?.chest?.toString() || '');
  const [waist, setWaist] = useState(latest?.waist?.toString() || '');
  const [hips, setHips] = useState(latest?.hips?.toString() || '');
  const [arms, setArms] = useState(latest?.arms?.toString() || '');
  const [thighs, setThighs] = useState(latest?.thighs?.toString() || '');
  const [neck, setNeck] = useState(latest?.neck?.toString() || '');

  const fields = [
    { label: 'חזה', value: chest, setter: setChest },
    { label: 'מותניים', value: waist, setter: setWaist },
    { label: 'אגן', value: hips, setter: setHips },
    { label: 'זרועות', value: arms, setter: setArms },
    { label: 'ירכיים', value: thighs, setter: setThighs },
    { label: 'צוואר', value: neck, setter: setNeck },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-lg bg-[#1C1C1E] rounded-t-[28px] p-6 max-h-[82vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">עדכון מידות</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.1] flex items-center justify-center text-[#8E8E93]"><X size={17} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {fields.map(f => (
            <div key={f.label}>
              <label className="text-[11px] text-[#8E8E93] mb-1.5 block font-medium">{f.label} (ס״מ)</label>
              <input type="number" value={f.value} onChange={e => f.setter(e.target.value)} placeholder="—"
                className="w-full bg-[#2C2C2E] rounded-[14px] py-3 px-4 text-white text-sm placeholder-[#8E8E93] outline-none focus:ring-1 focus:ring-[var(--color-primary)]/40 text-center" step="0.1" inputMode="decimal" />
            </div>
          ))}
        </div>
        <motion.button onClick={async () => {
          await onSave({ date: new Date().toISOString().split('T')[0], chest: chest ? parseFloat(chest) : undefined, waist: waist ? parseFloat(waist) : undefined, hips: hips ? parseFloat(hips) : undefined, arms: arms ? parseFloat(arms) : undefined, thighs: thighs ? parseFloat(thighs) : undefined, neck: neck ? parseFloat(neck) : undefined, notes: '' });
        }} className="w-full py-4 rounded-2xl bg-[var(--color-primary)] text-white font-bold text-base mt-5" whileTap={{ scale: 0.98 }}>
          שמור מידות
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

function AddRecoveryModal({ onSave, onClose }: { onSave: (r: Omit<RecoveryLog, 'id' | 'createdAt'>) => Promise<void>; onClose: () => void }) {
  const [sleepHours, setSleepHours] = useState(7);
  const [sleepQuality, setSleepQuality] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [sorenessLevel, setSorenessLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [energyLevel, setEnergyLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [stressLevel, setStressLevel] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [tightAreas, setTightAreas] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="w-full max-w-lg bg-[#1C1C1E] rounded-t-[28px] p-6 max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center mb-4">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">דיווח ריקאברי</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/[0.1] flex items-center justify-center text-[#8E8E93]"><X size={17} /></button>
        </div>
        <div className="space-y-6">
          <SliderInput label="שעות שינה" value={sleepHours} onChange={setSleepHours} min={0} max={12} step={0.5} unit=" ש" color="#BF5AF2" />
          <SliderInput label="איכות שינה" value={sleepQuality} onChange={setSleepQuality} min={1} max={5} step={1} unit="" color="#BF5AF2" labels={['גרוע', 'עלוב', 'בסדר', 'טוב', 'מעולה']} />
          <SliderInput label="רמת כאב" value={sorenessLevel} onChange={setSorenessLevel} min={1} max={5} step={1} unit="" color="#FF9F0A" labels={['כואב מאוד', 'כואב', 'בסדר', 'טוב', 'רענן']} />
          <SliderInput label="רמת אנרגיה" value={energyLevel} onChange={setEnergyLevel} min={1} max={5} step={1} unit="" color="#30D158" labels={['מותש', 'נמוכה', 'בסדר', 'טובה', 'מלא אנרגיה']} />
          <SliderInput label="רמת לחץ" value={stressLevel} onChange={setStressLevel} min={1} max={5} step={1} unit="" color="#0A84FF" labels={['מלחיץ מאוד', 'מלחיץ', 'בסדר', 'רגוע', 'רגוע לחלוטין']} />

          <div>
            <label className="text-sm text-[#8E8E93] mb-3 block font-medium">אזורים תפוסים</label>
            <div className="flex flex-wrap gap-2">
              {TIGHTNESS_AREAS.map(area => (
                <button key={area}
                  onClick={() => setTightAreas(prev => prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area])}
                  className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-all duration-150 ${
                    tightAreas.includes(area)
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'bg-white/[0.08] text-[#8E8E93]'
                  }`}>
                  {area}
                </button>
              ))}
            </div>
          </div>

          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="הערות (אופציונלי)"
            className="w-full bg-[#2C2C2E] rounded-[14px] py-3.5 px-4 text-white text-sm placeholder-[#8E8E93] outline-none focus:ring-1 focus:ring-[var(--color-primary)]/40" />

          <motion.button onClick={async () => {
            await onSave({ date: new Date().toISOString().split('T')[0], sleepHours, sleepQuality, sorenessLevel, energyLevel, stressLevel, tightAreas, notes });
          }} className="w-full py-4 rounded-2xl bg-[var(--color-primary)] text-white font-bold text-base" whileTap={{ scale: 0.98 }}>
            שמור
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SliderInput({ label, value, onChange, min, max, step, unit, color, labels }: {
  label: string; value: number; onChange: (v: any) => void; min: number; max: number; step: number; unit: string; color: string; labels?: string[];
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-[#8E8E93] font-medium">{label}</span>
        <span className="font-black text-base" style={{ color }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer" style={{ accentColor: color }} />
      {labels && (
        <div className="flex justify-between text-[10px] text-[#8E8E93] mt-1.5">
          {labels.map(l => <span key={l}>{l}</span>)}
        </div>
      )}
    </div>
  );
}
