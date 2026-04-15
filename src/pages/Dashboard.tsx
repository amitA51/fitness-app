/**
 * SparkOS Fitness - Dashboard (Premium Design System)
 * Asymmetric Bento Grid, Double-Bezel Cards, Spring Physics
 */

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame, Clock, TrendingUp, Dumbbell, ChevronLeft, ChevronRight, Plus,
  Target, Zap, UtensilsCrossed, Heart, Scale, BarChart2, Sparkles,
} from 'lucide-react';
import { getWorkoutTemplates } from '../services/workoutDb';
import { getTodayMacros } from '../services/nutritionService';
import { getLatestWeight } from '../services/bodyStatsService';
import { useFitnessInsights } from '../hooks/fitness/useFitnessInsights';
import type { WorkoutSession, WorkoutTemplate } from '../types';
import type { MacroNutrients } from '../types';

// ── Types ────────────────────────────────────────────────────────────────────
interface DashboardProps { theme: string; onThemeChange: (t: string) => void; }

// ── Mock Data (Fallback) ─────────────────────────────────────────────────────
const MOCK_TEMPLATES: WorkoutTemplate[] = [
  { id: 'template-1', name: 'חזה + כתפיים', description: '', exercises: [], createdAt: '', updatedAt: '', lastUsed: '2026-04-08T00:00:00.000Z', timesUsed: 12, isFavorite: true },
  { id: 'template-2', name: 'גב + ידיים', description: '', exercises: [], createdAt: '', updatedAt: '', lastUsed: '2026-04-06T00:00:00.000Z', timesUsed: 8, isFavorite: true },
  { id: 'template-3', name: 'אימון רגליים', description: '', exercises: [], createdAt: '', updatedAt: '', lastUsed: null, timesUsed: 5, isFavorite: false },
  { id: 'template-4', name: 'בטן + ליבה', description: '', exercises: [], createdAt: '', updatedAt: '', lastUsed: null, timesUsed: 3, isFavorite: false },
];

// ── Utils ────────────────────────────────────────────────────────────────────
const getWeekStart = (d: Date) => { const t = new Date(d); const day = t.getDay(); t.setDate(t.getDate() - day + (day === 0 ? -6 : 1)); return t; };
const getWeekEnd = (weekStart: Date) => { const t = new Date(weekStart); t.setDate(t.getDate() + 6); return t; };
const fmtDuration = (s: number) => { const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); return h > 0 ? `${h}:${String(m).padStart(2,'0')}` : `${m} דק׳`; };
const fmtDate = (d: string) => { const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000); return diff === 0 ? 'היום' : diff === 1 ? 'אתמול' : diff < 7 ? `לפני ${diff} ימים` : new Date(d).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' }); };
const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'בוקר טוב' : h < 17 ? 'צהריים טובים' : 'ערב טוב'; };
const todayHe = () => new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
const DAYS = ['א','ב','ג','ד','ה','ו','ש'] as const;
const THEMES = ['deepCosmos','fireEnergy','neonPulse','oceanWave','forestGrove'];

// ── Spring Animation Variants ───────────────────────────────────────────────
const springTransition = { type: 'spring' as const, stiffness: 100, damping: 20 };

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { ...springTransition, opacity: 1, y: 0 },
};

// ── WeeklyDots ───────────────────────────────────────────────────────────────
const WeeklyDots = memo(function WeeklyDots({ 
  sessions, 
  weekOffset, 
  onPrevWeek, 
  onNextWeek, 
}: { 
  sessions: WorkoutSession[]; 
  weekOffset: number; 
  onPrevWeek: () => void; 
  onNextWeek: () => void;
}) {
  const { weekStart, days, weekLabel, isCurrentWeek } = useMemo(() => {
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const targetWeekStart = new Date(currentWeekStart);
    targetWeekStart.setDate(targetWeekStart.getDate() + (weekOffset * 7));
    
    const weekEnd = getWeekEnd(targetWeekStart);
    const done = new Set(
      sessions
        .filter(s => s.status === 'completed')
        .map(s => s.date || s.startTime.split('T')[0])
    );
    
    const daysArray = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(targetWeekStart);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const today = new Date().toISOString().split('T')[0];
      return { 
        letter: DAYS[d.getDay()], 
        active: done.has(dateStr), 
        isToday: dateStr === today,
        date: d,
      };
    });
    
    let weekLabel: string;
    if (weekOffset === 0) {
      weekLabel = 'שבוע זה';
    } else if (weekOffset === -1) {
      weekLabel = 'שבוע שעבר';
    } else if (weekOffset === 1) {
      weekLabel = 'שבוע הבא';
    } else {
      const startDay = targetWeekStart.getDate();
      const endDay = weekEnd.getDate();
      const startMonth = targetWeekStart.toLocaleDateString('he-IL', { month: 'short' });
      const endMonth = weekEnd.toLocaleDateString('he-IL', { month: 'short' });
      if (startMonth === endMonth) {
        weekLabel = `${startDay} - ${endDay} ${startMonth}`;
      } else {
        weekLabel = `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
      }
    }
    
    return { 
      weekStart: targetWeekStart, 
      days: daysArray, 
      weekLabel,
      isCurrentWeek: weekOffset === 0,
    };
  }, [sessions, weekOffset]);

  return (
    <div className="space-y-4">
      {/* Week Navigation Header */}
      <div className="flex items-center justify-between">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onPrevWeek}
          className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center transition-colors hover:bg-white/[0.08] min-w-[40px]"
          aria-label="שבוע קודם"
        >
          <ChevronRight size={18} className="text-label-secondary" />
        </motion.button>
        
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-white">{weekLabel}</span>
          {isCurrentWeek && (
            <motion.span 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ ...springTransition, delay: 0.2 }}
              className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-primary/15 text-primary"
            >
              היום
            </motion.span>
          )}
        </div>
        
        <motion.button
          whileHover={{ scale: weekOffset >= 0 ? 1 : 1.05 }}
          whileTap={{ scale: weekOffset >= 0 ? 1 : 0.95 }}
          onClick={onNextWeek}
          disabled={weekOffset >= 0}
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all min-w-[40px] ${
            weekOffset >= 0 
              ? 'bg-transparent border border-white/[0.04] cursor-not-allowed opacity-40' 
              : 'bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08]'
          }`}
          aria-label="שבוע הבא"
        >
          <ChevronLeft size={18} className="text-label-secondary" />
        </motion.button>
      </div>

      {/* Days Dots — Premium Design */}
      <motion.div 
        key={weekOffset}
        initial={{ opacity: 0, x: weekOffset > 0 ? 20 : -20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: weekOffset > 0 ? -20 : 20 }}
        transition={{ duration: 0.25 }}
        className="flex justify-between items-end gap-1.5"
      >
        {days.map((day, i) => (
          <motion.div 
            key={i} 
            className="flex flex-col items-center gap-2 flex-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springTransition, delay: i * 0.05 }}
          >
            {/* Dot */}
            <motion.div
              whileHover={{ scale: 1.1 }}
              className={[
                'w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-bold transition-all relative',
                day.active 
                  ? 'bg-primary text-white shadow-[0_4px_16px_rgba(59,130,246,0.3)]' 
                  : day.isToday 
                    ? 'border-2 border-primary/50 text-primary bg-primary/10' 
                    : 'bg-white/[0.04] text-label-secondary',
              ].join(' ')}
            >
              {day.letter}
              {day.active && day.isToday && (
                <motion.div 
                  layoutId="activeDot"
                  className="absolute -bottom-1 w-2 h-2 rounded-full bg-white"
                  initial={false}
                  transition={{ ...springTransition }}
                />
              )}
            </motion.div>
            
            {/* Today Indicator */}
            {day.isToday && !day.active && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ ...springTransition }}
                className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" 
              />
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
});

// ── StatCard — Premium Bento Tile ───────────────────────────────────────────
const StatCard = memo(function StatCard({ value, label, icon: Icon, iconColor, iconBg, delay = 0 }: {
  value: string | number; label: string; icon: React.ElementType;
  iconColor: string; iconBg: string; delay?: number;
}) {
  return (
    <motion.div
      className="card-interactive p-5 flex flex-col gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springTransition, delay }}
      whileHover={{ y: -2 }}
    >
      {/* Icon with Background */}
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}>
        <Icon size={20} strokeWidth={2} className={iconColor} />
      </div>
      
      {/* Content */}
      <div>
        <p className="text-[32px] font-bold text-white leading-none tracking-tight font-condensed">{value}</p>
        <p className="text-[12px] text-label-secondary mt-2 leading-snug">{label}</p>
      </div>
    </motion.div>
  );
});

// ── PillCard ─────────────────────────────────────────────────────────────────
const PillCard = memo(function PillCard({ icon: Icon, iconColor, iconBg, value, label, onClick }: {
  icon: React.ElementType; iconColor: string; iconBg: string;
  value: string | number; label: string; onClick: () => void;
}) {
  return (
    <motion.button 
      onClick={onClick} 
      whileTap={{ scale: 0.95 }}
      className="card-interactive flex-1 min-h-[100px] p-4 flex flex-col items-center justify-center gap-3 text-center"
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg} animate-float`}>
        <Icon size={18} strokeWidth={2} className={iconColor} />
      </div>
      <div>
        <p className="text-[18px] font-bold text-white leading-tight">{value}</p>
        <p className="text-[11px] text-label-secondary mt-0.5">{label}</p>
      </div>
    </motion.button>
  );
});

// ── RecentWorkoutCard ────────────────────────────────────────────────────────
const RecentCard = memo(function RecentCard({ session, onClick, index }: { 
  session: WorkoutSession; onClick: () => void; index: number;
}) {
  const muscles = useMemo(() => {
    const g = new Set<string>();
    session.exercises?.forEach(e => { if (e.targetMuscle) g.add(e.targetMuscle); });
    return Array.from(g).slice(0, 3);
  }, [session.exercises]);
  const vol = session.totalVolume >= 1000 ? `${(session.totalVolume/1000).toFixed(1)}K` : String(session.totalVolume || 0);

  return (
    <motion.button 
      onClick={onClick} 
      layout
      whileTap={{ scale: 0.98 }}
      className="w-full card-interactive p-5 text-right"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ ...springTransition, delay: index * 0.06 }}
    >
      {/* Status Badge */}
      <div className="flex items-start justify-between mb-4">
        <span className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg ${
          session.status === 'completed' 
            ? 'bg-success/15 text-success' 
            : 'bg-warning/15 text-warning'
        }`}>
          {session.status === 'completed' ? 'הושלם' : 'בטיפול'}
        </span>
        <div className="text-start">
          <p className="text-[15px] font-semibold text-white">{session.templateId ? 'אימון מתבנית' : 'אימון חופשי'}</p>
          <p className="text-[12px] text-label-secondary mt-0.5">{fmtDate(session.date || session.startTime)}</p>
        </div>
      </div>
      
      {/* Meta Row */}
      <div className="flex items-center justify-end gap-5 text-[13px] text-label-secondary">
        {session.duration > 0 && (
          <span className="flex items-center gap-1.5">
            <Clock size={14} />{fmtDuration(session.duration)}
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <Dumbbell size={14} />{session.exercises?.length || 0} תרגילים
        </span>
        {session.totalVolume > 0 && (
          <span className="flex items-center gap-1.5">
            <TrendingUp size={14} />{vol} ק״ג
          </span>
        )}
      </div>
      
      {/* Muscle Tags */}
      {muscles.length > 0 && (
        <div className="flex gap-2 mt-4 justify-end flex-wrap">
          {muscles.map(m => (
            <span key={m} className="text-[10px] px-2.5 py-1 rounded-lg bg-white/[0.04] text-label-secondary border border-white/[0.06]">
              {m}
            </span>
          ))}
        </div>
      )}
    </motion.button>
  );
});

// ── TemplateCard ──────────────────────────────────────────────────────────────
const TemplateCard = memo(function TemplateCard({ template, onClick, index }: { 
  template: WorkoutTemplate; onClick: () => void; index: number;
}) {
  return (
    <motion.button 
      onClick={onClick} 
      whileTap={{ scale: 0.95 }}
      className="flex-shrink-0 w-[160px] card-interactive p-4 text-right"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...springTransition, delay: index * 0.05 }}
    >
      <div className="flex items-center justify-between mb-4">
        {template.isFavorite && (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
          >
            <Flame size={14} className="text-warning" />
          </motion.div>
        )}
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center ms-auto">
          <Target size={18} className="text-primary" />
        </div>
      </div>
      <p className="text-[14px] font-semibold text-white line-clamp-2 leading-snug mb-2">{template.name}</p>
      <p className="text-[11px] text-label-secondary">{template.exercises?.length || 0} תרגילים</p>
    </motion.button>
  );
});

// ── Empty State ───────────────────────────────────────────────────────────────
const EmptyState = memo(function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <motion.div 
      className="flex flex-col items-center py-14 px-6 text-center"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springTransition }}
    >
      {/* Icon with Glow */}
      <motion.div 
        className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 relative"
        animate={{ boxShadow: ['0 0 20px rgba(59,130,246,0.2)', '0 0 40px rgba(59,130,246,0.3)', '0 0 20px rgba(59,130,246,0.2)'] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        <Dumbbell size={32} className="text-primary" />
      </motion.div>
      
      <p className="text-[18px] font-bold text-white mb-2">אין אימונים עדיין</p>
      <p className="text-[13px] text-label-secondary mb-8 max-w-[240px] leading-relaxed">
        התחל את האימון הראשון שלך ועקוב אחר ההתקדמות
      </p>
      
      <motion.button 
        onClick={onStart} 
        whileTap={{ scale: 0.95 }}
        className="btn btn-primary btn-pill gap-2"
      >
        <Zap size={16} />התחל עכשיו
      </motion.button>
    </motion.div>
  );
});

// ── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function Dashboard({ theme, onThemeChange }: DashboardProps) {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [macros, setMacros] = useState<MacroNutrients>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [weight, setWeight] = useState<number | null>(null);
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);

  // Centralized fitness insights
  const {
    loading: insightsLoading,
    currentStreak,
    recentPRs,
    workoutSessions,
  } = useFitnessInsights();

  useEffect(() => {
    async function load() {
      try {
        const rawTemplates = await getWorkoutTemplates();
        setTemplates(rawTemplates);
        const [m, w] = await Promise.all([getTodayMacros(), getLatestWeight()]);
        setMacros(m);
        if (w) setWeight(w.weight);
      } catch {
        setTemplates(MOCK_TEMPLATES);
      }
    }
    load();
    window.addEventListener('WORKOUT_SAVED', load);
    return () => window.removeEventListener('WORKOUT_SAVED', load);
  }, []);

  const sortedTemplates = useMemo(() => {
    return [...templates.filter(t => t.isFavorite), ...templates.filter(t => !t.isFavorite)].slice(0, 6);
  }, [templates]);

  const goToPrevWeek = useCallback(() => {
    setSelectedWeekOffset(prev => prev - 1);
  }, []);

  const goToNextWeek = useCallback(() => {
    setSelectedWeekOffset(prev => Math.min(prev + 1, 0));
  }, []);

  const weeklyStats = useMemo(() => {
    const currentWeekStart = getWeekStart(new Date());
    const targetWeekStart = new Date(currentWeekStart);
    targetWeekStart.setDate(targetWeekStart.getDate() + (selectedWeekOffset * 7));
    const targetWeekEnd = new Date(targetWeekStart);
    targetWeekEnd.setDate(targetWeekEnd.getDate() + 7);
    
    const weekSessions = workoutSessions.filter(s => {
      if (s.status !== 'completed') return false;
      const sessionDate = new Date(s.startTime);
      return sessionDate >= targetWeekStart && sessionDate < targetWeekEnd;
    });
    
    return {
      workoutsThisWeek: weekSessions.length,
      totalVolumeThisWeek: weekSessions.reduce((s, w) => s + (w.totalVolume || 0), 0),
      totalDurationThisWeek: weekSessions.reduce((s, w) => s + w.duration, 0),
      streakDays: currentStreak,
      weeklyGoal: 4,
    };
  }, [workoutSessions, currentStreak, selectedWeekOffset]);

  const volLabel = weeklyStats.totalVolumeThisWeek >= 1000 
    ? `${(weeklyStats.totalVolumeThisWeek/1000).toFixed(1)}K` 
    : String(weeklyStats.totalVolumeThisWeek);

  return (
    <motion.div 
      className="min-h-screen pb-28" 
      dir="rtl"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* ── HEADER ── */}
      <motion.header 
        className="sticky top-0 z-20 bg-[var(--color-background)]/95 backdrop-blur-xl safe-area-top px-5 pt-5 pb-5"
        variants={itemVariants}
      >
        <div className="flex items-center justify-between mb-5">
          {/* Greeting */}
          <div className="flex flex-col gap-1">
            <p className="text-[12px] text-label-secondary">שלום</p>
            <h1 className="text-[26px] font-bold text-white leading-tight tracking-tight font-condensed">
              {greeting()}
            </h1>
          </div>
          
          {/* Right Side */}
          <div className="flex items-center gap-3">
            <p className="text-[12px] text-label-secondary text-left leading-relaxed max-w-[120px] hidden sm:block">
              {todayHe()}
            </p>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.9 }}
              transition={{ ...springTransition }}
              onClick={() => onThemeChange(THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length])}
              className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center"
            >
              <Sparkles size={18} className="text-primary" />
            </motion.button>
          </div>
        </div>
        
        {/* Weekly Activity Label */}
        <p className="section-title mb-4">פעילות שבועית</p>
        
        <WeeklyDots 
          sessions={workoutSessions} 
          weekOffset={selectedWeekOffset}
          onPrevWeek={goToPrevWeek}
          onNextWeek={goToNextWeek}
        />
      </motion.header>

      <main className="px-5 pt-6 space-y-6">
        {/* ── HERO QUICK START — Premium Bento Style ── */}
        <motion.div variants={itemVariants}>
          <motion.button 
            onClick={() => navigate('/workout')} 
            whileHover={{ scale: 1.01, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="w-full relative overflow-hidden rounded-2xl 
                       bg-gradient-to-l from-primary via-primary to-primary/90
                       min-h-[90px] flex items-center gap-4 px-6 py-5
                       shadow-[0_8px_32px_rgba(59,130,246,0.25)]"
          >
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.3),transparent_60%)]" />
            </div>
            
            {/* Icon */}
            <div className="relative z-10 w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <Zap size={28} className="text-white" />
            </div>
            
            {/* Text */}
            <div className="relative z-10 flex-1 text-start">
              <p className="text-[22px] font-bold text-white leading-tight">התחל אימון</p>
              <p className="text-[13px] text-white/70 mt-1">בחר תבנית או התחל חופשי</p>
            </div>
            
            {/* Arrow */}
            <div className="relative z-10 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
              <ChevronLeft size={20} className="text-white/80" />
            </div>
          </motion.button>
        </motion.div>

        {/* ── STATS BENTO GRID — Asymmetric 2x2 ── */}
        <motion.div 
          variants={itemVariants}
          className="grid grid-cols-2 gap-3"
        >
          {/* Wide Card */}
          <motion.div 
            className="col-span-2 card-interactive p-5 flex flex-row items-center gap-4"
            whileHover={{ y: -2 }}
          >
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
              <Dumbbell size={22} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-[36px] font-bold text-white leading-none tracking-tight font-condensed">
                {weeklyStats.workoutsThisWeek}
              </p>
              <p className="text-[12px] text-label-secondary mt-2">אימונים השבוע</p>
            </div>
            {/* Progress Ring */}
            <div className="relative w-16 h-16">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                <circle cx="32" cy="32" r="28" fill="none" stroke="currentColor" strokeWidth="4" className="text-white/[0.06]" />
                <motion.circle 
                  cx="32" cy="32" r="28" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="4"
                  strokeLinecap="round"
                  className="text-primary"
                  strokeDasharray={`${(weeklyStats.workoutsThisWeek / weeklyStats.weeklyGoal) * 175.9} 175.9`}
                  initial={{ strokeDasharray: "0 175.9" }}
                  animate={{ strokeDasharray: `${(weeklyStats.workoutsThisWeek / weeklyStats.weeklyGoal) * 175.9} 175.9` }}
                  transition={{ ...springTransition, delay: 0.3 }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[14px] font-bold text-white">
                {weeklyStats.workoutsThisWeek}/{weeklyStats.weeklyGoal}
              </span>
            </div>
          </motion.div>
          
          <StatCard value={volLabel} label="ווליום (ק״ג)" icon={TrendingUp} iconColor="text-cyan-400" iconBg="bg-cyan-400/15" delay={0.05} />
          <StatCard value={fmtDuration(weeklyStats.totalDurationThisWeek)} label="משך זמן" icon={Clock} iconColor="text-violet-400" iconBg="bg-violet-400/15" delay={0.1} />
          
          {/* Streak - Wide */}
          <motion.div 
            className="col-span-2 card-interactive p-5 flex items-center gap-4"
            whileHover={{ y: -2 }}
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-12 h-12 rounded-xl bg-warning/15 flex items-center justify-center"
            >
              <Flame size={22} className="text-warning" />
            </motion.div>
            <div className="flex-1">
              <p className="text-[36px] font-bold text-white leading-none tracking-tight font-condensed">
                {weeklyStats.streakDays > 0 ? weeklyStats.streakDays : '—'}
              </p>
              <p className="text-[12px] text-label-secondary mt-2">ימי רצף</p>
            </div>
            {weeklyStats.streakDays > 0 && (
              <div className="eyebrow">🔥 {weeklyStats.streakDays} ימים</div>
            )}
          </motion.div>
        </motion.div>

        {/* ── QUICK PILLS ── */}
        <motion.div variants={itemVariants} className="flex gap-3">
          <PillCard icon={UtensilsCrossed} iconColor="text-orange-400" iconBg="bg-orange-400/15" value={macros.calories || '—'} label="קלוריות" onClick={() => navigate('/nutrition')} />
          <PillCard icon={Scale} iconColor="text-green-400" iconBg="bg-green-400/15" value={weight ? `${weight}` : '—'} label="משקל (ק״ג)" onClick={() => navigate('/progress')} />
          <PillCard icon={Heart} iconColor="text-rose-400" iconBg="bg-rose-400/15" value={recentPRs.length > 0 ? recentPRs.length : '—'} label="שיאים" onClick={() => navigate('/progress')} />
        </motion.div>

        {/* ── RECENT WORKOUTS ── */}
        <motion.section variants={itemVariants}>
          <div className="flex items-center justify-between mb-4">
            <motion.button 
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/history')} 
              className="text-[13px] font-semibold text-primary min-h-[44px] flex items-center"
            >
              הכל
            </motion.button>
            <div className="flex items-center gap-2">
              <BarChart2 size={16} className="text-label-secondary" />
              <h2 className="text-[18px] font-bold text-white font-condensed">היסטוריה</h2>
            </div>
          </div>
          
          {workoutSessions.length > 0 ? (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {workoutSessions.slice(0, 3).map((s, i) => (
                  <RecentCard key={s.id} session={s} onClick={() => navigate(`/history/${s.id}`)} index={i} />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <EmptyState onStart={() => navigate('/workout')} />
          )}
        </motion.section>

        {/* ── TEMPLATES SCROLL ── */}
        <motion.section variants={itemVariants}>
          <div className="flex items-center justify-between mb-4">
            <motion.button 
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/templates?create=true')}
              className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center min-w-[44px] min-h-[44px]"
            >
              <Plus size={18} className="text-label-secondary" />
            </motion.button>
            <div className="flex items-center gap-2">
              <Target size={16} className="text-label-secondary" />
              <h2 className="text-[18px] font-bold text-white font-condensed">תבניות שלי</h2>
            </div>
          </div>
          
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 no-scrollbar">
            <AnimatePresence mode="popLayout">
              {sortedTemplates.length > 0 ? (
                sortedTemplates.map((t, i) => (
                  <TemplateCard key={t.id} template={t} onClick={() => navigate(`/workout/${t.id}`)} index={i} />
                ))
              ) : (
                <motion.button 
                  onClick={() => navigate('/templates?create=true')} 
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex-shrink-0 w-[200px] min-h-[130px] rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 flex flex-col items-center justify-center gap-3"
                >
                  <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center">
                    <Plus size={24} className="text-primary" />
                  </div>
                  <span className="text-[13px] font-semibold text-primary">צור תבנית ראשונה</span>
                </motion.button>
              )}
              
              {sortedTemplates.length > 0 && (
                <motion.button 
                  onClick={() => navigate('/templates?create=true')} 
                  whileTap={{ scale: 0.95 }}
                  className="flex-shrink-0 w-[140px] h-[110px] rounded-2xl border border-dashed border-white/[0.08] flex flex-col items-center justify-center gap-2 hover:border-primary/30"
                >
                  <Plus size={20} className="text-label-tertiary" />
                  <span className="text-[12px] text-label-tertiary">תבנית חדשה</span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </motion.section>

        <div className="h-8" />
      </main>
    </motion.div>
  );
}
