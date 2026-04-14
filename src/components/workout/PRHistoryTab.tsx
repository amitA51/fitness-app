import React, { useState, useEffect, useMemo } from 'react';
import { PersonalRecord, calculatePRsFromHistory } from '../../services/prService';
import { getWorkoutSessions } from '../../services/dataService';
import { TrophyIcon } from '../icons';
import { motion, AnimatePresence } from 'framer-motion';

type SortOption = 'date' | 'weight' | 'name';

/**
 * PRHistoryTab - Personal Records History with Hebrew UI, filtering, and skeleton loading
 */
const PRHistoryTab: React.FC = () => {
  const [prMap, setPRMap] = useState<Map<string, PersonalRecord>>(new Map());
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('date');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadPRs = async () => {
      try {
        const sessions = await getWorkoutSessions();
        const calculatedPRs = calculatePRsFromHistory(sessions);
        setPRMap(calculatedPRs);
      } catch (e) {
        console.error('Failed to load PRs:', e);
      } finally {
        setLoading(false);
      }
    };
    loadPRs();
  }, []);

  const filteredPRs = useMemo(() => {
    let prList = Array.from(prMap.values());

    // Filter by search
    if (searchQuery.trim()) {
      prList = prList.filter(pr =>
        pr.exerciseName.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    switch (sortBy) {
      case 'date':
        prList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        break;
      case 'weight':
        prList.sort((a, b) => (b.maxWeight ?? 0) - (a.maxWeight ?? 0));
        break;
      case 'name':
        prList.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
        break;
    }

    return prList;
  }, [prMap, sortBy, searchQuery]);

  // Skeleton loading
  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="bg-white/5 rounded-xl p-4 animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/10 rounded w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (prMap.size === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4"
        >
          <TrophyIcon className="w-10 h-10 text-yellow-400/50" />
        </motion.div>
        <h3 className="text-lg font-bold text-white mb-2">השיאים שלך יופיעו כאן</h3>
        <p className="text-white/40 text-sm">
          סיים אימונים כדי להתחיל לצבור שיאים אישיים
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {/* Search & Sort */}
      <div className="sticky top-0 bg-gradient-to-b from-[#0a0a0f] via-[#0a0a0f] to-transparent pb-4 z-10">
        {/* Search Bar */}
        <div className="relative mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="חפש תרגיל..."
            className="w-full h-11 pl-4 pr-10 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-[var(--cosmos-accent-primary)]"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30">◌</span>
        </div>

        {/* Sort Options */}
        <div className="flex gap-2">
          {[
            { id: 'date', label: 'תאריך' },
            { id: 'weight', label: 'משקל' },
            { id: 'name', label: 'שם' },
          ].map(option => (
            <button
              key={option.id}
              onClick={() => setSortBy(option.id as SortOption)}
              className={`px-4 py-2 min-h-[36px] rounded-full text-xs font-semibold transition-all ${sortBy === option.id
                ? 'bg-[var(--cosmos-accent-primary)] text-black'
                : 'bg-white/5 text-white/60 border border-white/10'
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* PR Count */}
      <div className="text-center text-sm text-white/50">
        {filteredPRs.length} שיאים אישיים
      </div>

      {/* PR List */}
      <div className="space-y-3 -mr-2 pr-2 overflow-y-auto custom-scrollbar max-h-[60vh]">
        <AnimatePresence>
          {filteredPRs.map((pr, index) => (
            <motion.div
              key={pr.exerciseName}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.03 }}
              className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-yellow-400/30 rounded-xl p-4 transition-all group"
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-yellow-400/10 flex items-center justify-center">
                  <TrophyIcon className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-white text-sm truncate">
                    {pr.exerciseName}
                  </h3>
                  <p className="text-[10px] text-white/40">
                    {new Date(pr.date).toLocaleDateString('he-IL', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="bg-white/5 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                    משקל מקס
                  </div>
                  <div className="text-white font-bold text-base">
                    {pr.maxWeight}<span className="text-xs text-white/50">kg</span>
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-2.5 text-center">
                  <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">
                    חזרות
                  </div>
                  <div className="text-white font-bold text-base">
                    {pr.maxWeightReps}
                  </div>
                </div>
                <div className="bg-yellow-400/10 rounded-lg p-2.5 text-center border border-yellow-400/20">
                  <div className="text-[10px] text-yellow-400 uppercase tracking-wider mb-1">
                    1RM הערכה
                  </div>
                  <div className="text-yellow-400 font-bold text-base">
                    ~{pr.oneRepMax}<span className="text-xs text-yellow-400/60">kg</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* No Results */}
        {filteredPRs.length === 0 && searchQuery && (
          <div className="text-center py-8">
            <p className="text-white/40">לא נמצאו תוצאות עבור "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(PRHistoryTab);
