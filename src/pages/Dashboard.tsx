/**
 * SparkOS Fitness - Dashboard (Apple OLED Dark, RTL Hebrew)
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, Clock, TrendingUp, Dumbbell, ChevronLeft, Plus,
  Target, Zap, UtensilsCrossed, Heart, Scale, BarChart2, Sparkles,
} from 'lucide-react';
import { getWorkoutSessions, getWorkoutTemplates } from '../services/workoutDb';
import { getTodayMacros } from '../services/nutritionService';
import { getLatestWeight, getTodayRecoveryLog, calculateRecoveryScore } from '../services/bodyStatsService';
import type { WorkoutSession, WorkoutTemplate } from '../types';
import type { MacroNutrients } from '../types';

// ── Types ────────────────────────────────────────────────────────────────────
interface DashboardProps { theme: string; onThemeChange: (t: string) => void; }
interface WeeklyStats {
  workoutsThisWeek: number; totalVolumeThisWeek: number;
  totalDurationThisWeek: number; streakDays: number; weeklyGoal: number;
}

// ── Mock data (fallback) ─────────────────────────────────────────────────────
const MOCK_TEMPLATES: WorkoutTemplate[] = [
  { id: 'template-1', name: 'חזה + כתפיים', description: '', exercises: [], createdAt: '', updatedAt: '', lastUsed: '2026-04-08T00:00:00.000Z', timesUsed: 12, isFavorite: true },
  { id: 'template-2', name: 'גב + ידיים', description: '', exercises: [], createdAt: '', updatedAt: '', lastUsed: '2026-04-06T00:00:00.000Z', timesUsed: 8, isFavorite: true },
  { id: 'template-3', name: 'אימון רגליים', description: '', exercises: [], createdAt: '', updatedAt: '', lastUsed: null, timesUsed: 5, isFavorite: false },
  { id: 'template-4', name: 'בטן + ליבה', description: '', exercises: [], createdAt: '', updatedAt: '', lastUsed: null, timesUsed: 3, isFavorite: false },
];

// ── Utils ────────────────────────────────────────────────────────────────────
const getWeekStart = (d: Date) => { const t = new Date(d); const day = t.getDay(); t.setDate(t.getDate() - day + (day === 0 ? -6 : 1)); return t; };
const fmtDuration = (s: number) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h > 0 ? `${h}:${String(m).padStart(2,'0')}` : `${m} דק׳`; };
const fmtDate = (d: string) => { const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000); return diff === 0 ? 'היום' : diff === 1 ? 'אתמול' : diff < 7 ? `לפני ${diff} ימים` : new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }); };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : 'ערב טוב'; };
const todayHe = () => new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
const DAYS = ['א','ב','ג','ד','ה','ו','ש'] as const;
const THEMES = ['deepCosmos','fireEnergy','neonPulse','oceanWave','forestGrove'];

// ── WeeklyDots ───────────────────────────────────────────────────────────────
function WeeklyDots({ sessions }: { sessions: WorkoutSession[] }) {
  const days = useMemo(() => {
    const done = new Set(sessions.filter(s => s.status === 'completed').map(s => s.date || s.startTime.split('T')[0]));
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      return { letter: DAYS[d.getDay()], active: done.has(d.toISOString().split('T')[0]), isToday: i === 6 };
    });
  }, [sessions]);

  return (
    <div className="flex justify-between items-end gap-1">
      {days.map((day, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
          <div className={[
            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
            day.active ? 'bg-[var(--color-primary)] text-white shadow-[0_0_12px_var(--color-primary)]/50'
              : day.isToday ? 'border border-[var(--color-primary)]/60 text-[var(--color-primary)]'
              : 'bg-white/[0.06] text-[#8E8E93]',
          ].join(' ')}>
            {day.letter}
          </div>
          {day.isToday && <div className="w-1 h-1 rounded-full bg-[var(--color-primary)]" />}
        </div>
      ))}
    </div>
  );
}

// ── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ value, label, icon: Icon, iColor, iBg, delay = 0 }: {
  value: string | number; label: string; icon: React.ElementType;
  iColor: string; iBg: string; delay?: number;
}) {
  return (
    <motion.div
      className="flex-1 bg-[#111111] border border-white/[0.06] rounded-[20px] p-4 flex flex-col gap-3"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay }}
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iBg}`}>
        <Icon size={15} className={iColor} />
      </div>
      <div>
        <p className="text-[28px] font-black text-white leading-none tracking-tight">{value}</p>
        <p className="text-[11px] text-[#8E8E93] mt-1 leading-none">{label}</p>
      </div>
    </motion.div>
  );
}

// ── PillCard (Nutrition/Weight/Recovery) ─────────────────────────────────────
function PillCard({ icon: Icon, iColor, iBg, value, label, onClick }: {
  icon: React.ElementType; iColor: string; iBg: string;
  value: string | number; label: string; onClick: () => void;
}) {
  return (
    <motion.button onClick={onClick} whileTap={{ scale: 0.93 }}
      className="flex-1 min-h-[44px] bg-[#111111] border border-white/[0.06] rounded-2xl p-3.5 flex flex-col items-center gap-2">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iBg}`}>
        <Icon size={15} className={iColor} />
      </div>
      <p className="text-base font-black text-white leading-none">{value}</p>
      <p className="text-[10px] text-[#8E8E93] leading-none">{label}</p>
    </motion.button>
  );
}

// ── RecentWorkoutCard ─────────────────────────────────────────────────────────
function RecentCard({ session, onClick }: { session: WorkoutSession; onClick: () => void }) {
  const muscles = useMemo(() => {
    const g = new Set<string>();
    session.exercises?.forEach(e => { if (e.targetMuscle) g.add(e.targetMuscle); });
    return Array.from(g).slice(0, 3);
  }, [session.exercises]);
  const vol = session.totalVolume >= 1000 ? `${(session.totalVolume/1000).toFixed(1)}K` : String(session.totalVolume || 0);

  return (
    <motion.button onClick={onClick} whileTap={{ scale: 0.98 }} layout
      className="w-full bg-[#111111] border border-white/[0.06] rounded-[20px] p-4 text-right">
      <div className="flex items-start justify-between mb-3">
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${session.status === 'completed' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}>
          {session.status === 'completed' ? 'הושלם' : 'בטיפול'}
        </span>
        <div>
          <p className="text-[15px] font-semibold text-white">{session.templateId ? 'אימון מתבנית' : 'אימון חופשי'}</p>
          <p className="text-[12px] text-[#8E8E93] mt-0.5">{fmtDate(session.date || session.startTime)}</p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-4 text-[12px] text-[#8E8E93]">
        {session.duration > 0 && <span className="flex items-center gap-1"><Clock size={12} />{fmtDuration(session.duration)}</span>}
        <span className="flex items-center gap-1"><Dumbbell size={12} />{session.exercises?.length || 0} תרגילים</span>
        {session.totalVolume > 0 && <span className="flex items-center gap-1"><TrendingUp size={12} />{vol} ק״ג</span>}
      </div>
      {muscles.length > 0 && (
        <div className="flex gap-1.5 mt-3 justify-end flex-wrap">
          {muscles.map(m => <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.07] text-[#8E8E93]">{m}</span>)}
        </div>
      )}
    </motion.button>
  );
}

// ── TemplateCard ──────────────────────────────────────────────────────────────
function TemplateCard({ template, onClick }: { template: WorkoutTemplate; onClick: () => void }) {
  return (
    <motion.button onClick={onClick} whileTap={{ scale: 0.95 }}
      className="flex-shrink-0 w-40 bg-[#111111] border border-white/[0.06] rounded-[20px] p-4 text-right">
      <div className="flex items-center justify-between mb-3">
        {template.isFavorite && <Flame size={13} className="text-amber-400" />}
        <div className="w-9 h-9 rounded-[12px] bg-[var(--color-primary)]/15 flex items-center justify-center ms-auto">
          <Target size={17} className="text-[var(--color-primary)]" />
        </div>
      </div>
      <p className="text-[13px] font-semibold text-white line-clamp-2 leading-snug mb-1">{template.name}</p>
      <p className="text-[11px] text-[#8E8E93]">{template.exercises?.length || 0} תרגילים</p>
    </motion.button>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <motion.div className="flex flex-col items-center py-12 px-6 text-center"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <div className="w-16 h-16 rounded-full bg-[var(--color-primary)]/12 flex items-center justify-center mb-5">
        <Dumbbell size={28} className="text-[var(--color-primary)]" />
      </div>
      <p className="text-[17px] font-bold text-white mb-2">אין אימונים עדיין</p>
      <p className="text-[13px] text-[#8E8E93] mb-6 max-w-[240px] leading-relaxed">התחל את האימון הראשון שלך ועקוב אחר ההתקדמות</p>
      <motion.button onClick={onStart} whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 px-6 py-3 bg-[var(--color-primary)] text-white rounded-full text-[14px] font-semibold min-h-[44px]">
        <Zap size={16} />התחל עכשיו
      </motion.button>
    </motion.div>
  );
}

// ── MAIN DASHBOARD ────────────────────────────────────────────────────────────
export default function Dashboard({ theme, onThemeChange }: DashboardProps) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<WeeklyStats>({ workoutsThisWeek: 0, totalVolumeThisWeek: 0, totalDurationThisWeek: 0, streakDays: 0, weeklyGoal: 4 });
  const [macros, setMacros] = useState<MacroNutrients>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [weight, setWeight] = useState<number | null>(null);
  const [recovery, setRecovery] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const [rawSessions, rawTemplates] = await Promise.all([getWorkoutSessions(20), getWorkoutTemplates()]);
        setSessions(rawSessions);
        setTemplates(rawTemplates);

        const weekStart = getWeekStart(new Date());
        const weekSessions = rawSessions.filter(s => new Date(s.startTime) >= weekStart);
        let streak = 0;
        for (let i = 0; i < 30; i++) {
          const d = new Date(); d.setDate(d.getDate() - i);
          if (rawSessions.some(s => s.date === d.toISOString().split('T')[0] && s.status === 'completed')) streak++;
          else if (i > 0) break;
        }
        setStats({
          workoutsThisWeek: weekSessions.filter(s => s.status === 'completed').length,
          totalVolumeThisWeek: weekSessions.reduce((s, w) => s + (w.totalVolume || 0), 0),
          totalDurationThisWeek: weekSessions.reduce((s, w) => s + w.duration, 0),
          streakDays: streak, weeklyGoal: 4,
        });

        const [m, w, rec] = await Promise.all([getTodayMacros(), getLatestWeight(), getTodayRecoveryLog()]);
        setMacros(m);
        if (w) setWeight(w.weight);
        if (rec) setRecovery(calculateRecoveryScore(rec).score);
      } catch (e) {
        console.error('Dashboard load failed:', e);
        setTemplates(MOCK_TEMPLATES);
      } finally {
        setIsLoading(false);
      }
    }
    load();
    window.addEventListener('WORKOUT_SAVED', load);
    return () => window.removeEventListener('WORKOUT_SAVED', load);
  }, []);

  const sortedTemplates = useMemo(() => {
    return [...templates.filter(t => t.isFavorite), ...templates.filter(t => !t.isFavorite)].slice(0, 6);
  }, [templates]);

  const volLabel = stats.totalVolumeThisWeek >= 1000 ? `${(stats.totalVolumeThisWeek/1000).toFixed(1)}K` : String(stats.totalVolumeThisWeek);

  if (!isLoading && sessions.length === 0 && templates.length === 0) {
    return <div className="min-h-screen bg-black pb-28 safe-area-inset-top" dir="rtl"><EmptyState onStart={() => navigate('/workout')} /></div>;
  }

  return (
    <div className="min-h-screen bg-black pb-28" dir="rtl">

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-20 bg-black/90 backdrop-blur-xl safe-area-inset-top px-5 pt-5 pb-4 border-b border-white/[0.04]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col gap-0.5">
            <p className="text-[12px] text-[#8E8E93] leading-none">שלום 💪</p>
            <h1 className="text-[22px] font-black text-white leading-tight tracking-tight">{greeting()}</h1>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-[12px] text-[#8E8E93] text-left leading-relaxed max-w-[110px]">{todayHe()}</p>
            <motion.button whileTap={{ scale: 0.88 }}
              onClick={() => onThemeChange(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length])}
              className="w-11 h-11 rounded-full bg-white/[0.07] border border-white/[0.08] flex items-center justify-center">
              <Sparkles size={17} className="text-[var(--color-primary)]" />
            </motion.button>
          </div>
        </div>
        <p className="text-[11px] font-semibold text-[#8E8E93] uppercase tracking-widest mb-2.5">פעילות שבועית</p>
        <WeeklyDots sessions={sessions} />
      </header>

      <main className="px-5 pt-5 space-y-5">

        {/* ── HERO QUICK START ── */}
        <motion.button onClick={() => navigate('/workout')} whileTap={{ scale: 0.97 }}
          className="w-full relative overflow-hidden rounded-[24px] bg-gradient-to-l from-[var(--color-primary)] to-[var(--color-secondary)] min-h-[80px] flex items-center gap-4 px-5 py-5 shadow-[0_8px_32px_var(--color-primary)]/25"
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: 'easeOut' }}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
          <div className="relative z-10 w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Zap size={24} className="text-white fill-white" />
          </div>
          <div className="relative z-10 flex-1 text-right">
            <p className="text-[20px] font-black text-white leading-tight">התחל אימון</p>
            <p className="text-[13px] text-white/70 mt-0.5">בחר תבנית או התחל חופשי</p>
          </div>
          <ChevronLeft size={22} className="relative z-10 text-white/60 rtl:rotate-180 flex-shrink-0" />
        </motion.button>

        {/* ── STATS 2×2 GRID ── */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard value={stats.workoutsThisWeek} label="אימונים השבוע" icon={Dumbbell} iColor="text-[var(--color-primary)]" iBg="bg-[var(--color-primary)]/15" delay={0.05} />
          <StatCard value={volLabel} label="ווליום (ק״ג)" icon={TrendingUp} iColor="text-cyan-400" iBg="bg-cyan-400/15" delay={0.1} />
          <StatCard value={fmtDuration(stats.totalDurationThisWeek)} label="משך זמן" icon={Clock} iColor="text-violet-400" iBg="bg-violet-400/15" delay={0.15} />
          <StatCard value={stats.streakDays > 0 ? stats.streakDays : '—'} label="ימי רצף" icon={Flame} iColor="text-amber-400" iBg="bg-amber-400/15" delay={0.2} />
        </div>

        {/* ── QUICK PILLS ── */}
        <div className="flex gap-3">
          <PillCard icon={UtensilsCrossed} iColor="text-orange-400" iBg="bg-orange-400/15" value={macros.calories || '—'} label="קלוריות" onClick={() => navigate('/nutrition')} />
          <PillCard icon={Scale} iColor="text-green-400" iBg="bg-green-400/15" value={weight ? `${weight}` : '—'} label="משקל (ק״ג)" onClick={() => navigate('/progress')} />
          <PillCard icon={Heart} iColor="text-rose-400" iBg="bg-rose-400/15" value={recovery !== null ? recovery : '—'} label="התאוששות" onClick={() => navigate('/progress')} />
        </div>

        {/* ── RECENT WORKOUTS ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => navigate('/history')} className="text-[13px] font-semibold text-[var(--color-primary)] min-h-[44px] flex items-center">הכל</button>
            <div className="flex items-center gap-2">
              <BarChart2 size={16} className="text-[#8E8E93]" />
              <h2 className="text-[17px] font-bold text-white">היסטוריה</h2>
            </div>
          </div>
          {sessions.length > 0 ? (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {sessions.slice(0, 3).map((s, i) => (
                  <motion.div key={s.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3, delay: i * 0.06 }}>
                    <RecentCard session={s} onClick={() => navigate(`/history/${s.id}`)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <EmptyState onStart={() => navigate('/workout')} />
          )}
        </section>

        {/* ── TEMPLATES SCROLL ── */}
        {sortedTemplates.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => navigate('/templates?create=true')}
                className="w-9 h-9 rounded-full bg-white/[0.07] border border-white/[0.08] flex items-center justify-center min-h-[44px] min-w-[44px]">
                <Plus size={17} className="text-[#8E8E93]" />
              </button>
              <div className="flex items-center gap-2">
                <Target size={16} className="text-[#8E8E93]" />
                <h2 className="text-[17px] font-bold text-white">תבניות שלי</h2>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-5 px-5 no-scrollbar">
              <AnimatePresence mode="popLayout">
                {sortedTemplates.map((t, i) => (
                  <motion.div key={t.id} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.25, delay: i * 0.05 }} className="flex-shrink-0">
                    <TemplateCard template={t} onClick={() => navigate(`/workout/${t.id}`)} />
                  </motion.div>
                ))}
              </AnimatePresence>
              <motion.button onClick={() => navigate('/templates?create=true')} whileTap={{ scale: 0.95 }}
                className="flex-shrink-0 w-40 h-[120px] bg-[#111111] border border-dashed border-white/[0.10] rounded-[20px] flex flex-col items-center justify-center gap-2 hover:border-[var(--color-primary)]/50">
                <Plus size={20} className="text-[#8E8E93]" />
                <span className="text-[12px] text-[#8E8E93]">תבנית חדשה</span>
              </motion.button>
            </div>
          </section>
        )}

        <div className="h-6" />
      </main>
    </div>
  );
}
