import { useState, useEffect, useCallback } from 'react';
import { Dumbbell, Clock, Trash2, ChevronLeft, BarChart2, Layers } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getWorkoutSessions, deleteWorkoutSession } from '../services/workoutDb';
import type { WorkoutSession } from '../types';

// ============================================================================
// HELPERS
// ============================================================================

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEBREW_MONTHS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = HEBREW_DAYS[date.getDay()];
  const month = HEBREW_MONTHS[date.getMonth()];
  return `יום ${day}, ${date.getDate()} ${month}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)} דקות`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}:${String(minutes).padStart(2, '0')} שעות` : `${hours} שעות`;
}

function countCompletedSets(session: WorkoutSession): number {
  return session.exercises.reduce(
    (total, ex) => total + ex.sets.filter((s) => s.isCompleted).length,
    0
  );
}

// ============================================================================
// SKELETON CARD
// ============================================================================

function SkeletonCard() {
  return (
    <div className="relative bg-[#111111] rounded-[20px] border border-white/[0.06] overflow-hidden p-4">
      <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-primary/30 rounded-r-[20px]" />
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0 pr-4">
          <div className="h-5 w-2/3 rounded-lg skeleton-shimmer mb-2" />
          <div className="h-3.5 w-1/3 rounded-md skeleton-shimmer" />
        </div>
        <div className="w-8 h-8 rounded-xl skeleton-shimmer shrink-0" />
      </div>
      <div className="flex gap-3 mb-3">
        <div className="h-7 w-24 rounded-full skeleton-shimmer" />
        <div className="h-7 w-20 rounded-full skeleton-shimmer" />
        <div className="h-7 w-28 rounded-full skeleton-shimmer" />
      </div>
      <div className="flex gap-2">
        <div className="h-6 w-16 rounded-full skeleton-shimmer" />
        <div className="h-6 w-20 rounded-full skeleton-shimmer" />
        <div className="h-6 w-14 rounded-full skeleton-shimmer" />
      </div>
    </div>
  );
}

// ============================================================================
// SESSION CARD
// ============================================================================

interface SessionCardProps {
  session: WorkoutSession;
  onDelete: (id: string) => void;
}

function SessionCard({ session, onDelete }: SessionCardProps) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const completedSets = countCompletedSets(session);
  const exerciseNames = session.exercises.map((e) => e.exerciseName);

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (confirmDelete) {
      onDelete(session.id);
    } else {
      setConfirmDelete(true);
    }
  }

  function handleCardClick() {
    if (confirmDelete) {
      setConfirmDelete(false);
      return;
    }
    navigate(`/history/${session.id}`);
  }

  return (
    <div
      className="relative bg-[#111111] rounded-[20px] border border-white/[0.06] overflow-hidden cursor-pointer transition-all duration-200 hover:border-white/[0.12] hover:bg-[#161616] active:scale-[0.99]"
      onClick={handleCardClick}
    >
      {/* Primary color left border accent */}
      <div className="absolute right-0 top-0 bottom-0 w-[3px] bg-primary rounded-r-[20px]" />

      <div className="p-4 pr-5">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0 pr-3">
            <p className="font-barlow-condensed font-bold text-[17px] text-white leading-tight truncate">
              {session.notes || 'אימון חופשי'}
            </p>
            <p className="text-[13px] text-[#8E8E93] mt-0.5 font-barlow">
              {formatDate(session.date)}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleDeleteClick}
              className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl transition-all duration-200 ${
                confirmDelete
                  ? 'bg-red-500/20 text-red-400 scale-95'
                  : 'text-[#48484A] hover:text-red-400 hover:bg-red-500/10 active:scale-90'
              }`}
              title={confirmDelete ? 'לחץ שוב לאישור' : 'מחק אימון'}
            >
              <Trash2 size={16} />
            </button>
            <div className="min-w-[44px] min-h-[44px] flex items-center justify-center">
              <ChevronLeft size={16} className="text-[#48484A]" />
            </div>
          </div>
        </div>

        {/* Stats pills row */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className="flex items-center gap-1.5 bg-white/[0.06] rounded-full px-3 py-1.5 text-[12px] font-barlow font-medium text-[#8E8E93]">
            <Clock size={12} className="text-blue-400 shrink-0" />
            {formatDuration(session.duration)}
          </span>

          <span className="flex items-center gap-1.5 bg-white/[0.06] rounded-full px-3 py-1.5 text-[12px] font-barlow font-medium text-[#8E8E93]">
            <Layers size={12} className="text-purple-400 shrink-0" />
            {completedSets} סטים
          </span>

          <span className="flex items-center gap-1.5 bg-white/[0.06] rounded-full px-3 py-1.5 text-[12px] font-barlow font-medium text-[#8E8E93]">
            <BarChart2 size={12} className="text-green-400 shrink-0" />
            {session.totalVolume.toLocaleString()} ק"ג
          </span>
        </div>

        {/* Exercise name chips */}
        {exerciseNames.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {exerciseNames.slice(0, 3).map((name, idx) => (
              <span
                key={idx}
                className="text-[11px] font-barlow text-[#48484A] bg-white/[0.04] border border-white/[0.06] rounded-full px-2.5 py-1 leading-none"
              >
                {name}
              </span>
            ))}
            {exerciseNames.length > 3 && (
              <span className="text-[11px] font-barlow text-[#48484A] bg-white/[0.04] border border-white/[0.06] rounded-full px-2.5 py-1 leading-none">
                +{exerciseNames.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Confirm delete message */}
        {confirmDelete && (
          <p className="mt-3 text-[12px] font-barlow text-red-400 font-medium">
            לחץ שוב למחיקה
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// HISTORY PAGE
// ============================================================================

export default function History() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getWorkoutSessions(100);
      const sorted = [...data].sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      );
      setSessions(sorted);
    } catch {
      setError('שגיאה בטעינת ההיסטוריה. נסה שוב.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteWorkoutSession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch {
      setError('שגיאה במחיקת האימון. נסה שוב.');
    }
  }, []);

  return (
    <div className="min-h-screen bg-black pb-[88px] pb-[calc(88px+env(safe-area-inset-bottom))]" dir="rtl">
      <div className="px-4 pt-6">

        {/* Header */}
        <div className="mb-6">
          <h1 className="font-barlow-condensed font-bold text-3xl text-white tracking-wide leading-none">
            היסטוריה
          </h1>
          {!loading && sessions.length > 0 && (
            <p className="font-barlow text-[14px] text-[#8E8E93] mt-1.5">
              {sessions.length} אימונים הושלמו
            </p>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-4 rounded-[16px] bg-red-500/10 border border-red-500/20 text-red-400 text-[14px] font-barlow">
            {error}
          </div>
        )}

        {/* Loading — skeleton cards */}
        {loading && (
          <div className="flex flex-col gap-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {/* Empty state */}
        {!loading && sessions.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-24 gap-5">
            <div className="w-20 h-20 rounded-[24px] bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
              <Dumbbell size={36} className="text-[#48484A]" />
            </div>
            <div className="text-center">
              <p className="font-barlow-condensed font-bold text-[20px] text-white">
                עדיין לא ביצעת אימון
              </p>
              <p className="font-barlow text-[14px] text-[#8E8E93] mt-1.5">
                התחל את האימון הראשון שלך עכשיו
              </p>
            </div>
            <button
              onClick={() => navigate('/workout')}
              className="min-h-[44px] px-7 py-3 rounded-[14px] bg-primary text-white font-barlow font-semibold text-[15px] transition-all duration-200 hover:opacity-90 active:scale-95"
            >
              התחל אימון
            </button>
          </div>
        )}

        {/* Session list */}
        {!loading && sessions.length > 0 && (
          <div className="flex flex-col gap-3">
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
