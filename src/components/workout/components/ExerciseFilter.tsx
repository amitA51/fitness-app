import React, { useState, useRef, useEffect } from 'react';
import { SearchIcon } from '../../icons';
import { MUSCLE_GROUPS } from '../../../constants';
import { PersonalExercise } from '../../../types';

interface ExerciseFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedMuscleGroup: string;
  onMuscleGroupChange: (group: string) => void;
  exercises?: PersonalExercise[];
  onSuggestionSelect?: (exercise: PersonalExercise) => void;
}

const muscleGroupLabels: Record<string, string> = {
  all: 'הכל',
  Chest: 'חזה',
  Back: 'גב',
  Legs: 'רגליים',
  Shoulders: 'כתפיים',
  Arms: 'ידיים',
  Core: 'גוף',
  Cardio: 'אירובי',
  Abs: 'בטן',
  Other: 'אחר',
};

export const ExerciseFilter: React.FC<ExerciseFilterProps> = ({
  searchQuery,
  onSearchChange,
  selectedMuscleGroup,
  onMuscleGroupChange,
  exercises = [],
  onSuggestionSelect,
}) => {
  const muscleGroups = Object.values(MUSCLE_GROUPS);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<PersonalExercise[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get favorites (most used exercises)
  const favorites = exercises
    .filter(ex => (ex.useCount || 0) >= 5)
    .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
    .slice(0, 5);

  // Generate suggestions based on search query
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const query = searchQuery.toLowerCase();
    const matches = exercises
      .filter(ex =>
        ex.name?.toLowerCase().includes(query) ||
        ex.muscleGroup?.toLowerCase().includes(query)
      )
      .sort((a, b) => {
        // Prioritize exact matches
        const aExact = a.name?.toLowerCase().startsWith(query);
        const bExact = b.name?.toLowerCase().startsWith(query);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        // Then by use count
        return (b.useCount || 0) - (a.useCount || 0);
      })
      .slice(0, 6);

    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  }, [searchQuery, exercises]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSuggestionClick = (exercise: PersonalExercise) => {
    onSuggestionSelect?.(exercise);
    onSearchChange('');
    setShowSuggestions(false);
    inputRef.current?.blur();
  };

  return (
    <div ref={containerRef} className="space-y-3 mb-4 shrink-0 px-1 relative">
      {/* Search Input */}
      <div className="relative group">
        <SearchIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 group-focus-within:text-[var(--cosmos-accent-primary)] transition-colors" />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          onFocus={() => searchQuery.length >= 2 && setShowSuggestions(suggestions.length > 0)}
          placeholder="חיפוש תרגיל..."
          className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pr-12 pl-4 text-white placeholder-white/30 focus:outline-none focus:border-[var(--cosmos-accent-primary)]/50 focus:bg-white/10 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
        />
        {searchQuery && (
          <button
            onClick={() => {
              onSearchChange('');
              inputRef.current?.focus();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/40 hover:text-white/60 hover:bg-white/20 transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Smart Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute left-1 right-1 top-full mt-2 bg-[var(--bg-secondary)] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">
          {suggestions.map((exercise, index) => (
            <button
              key={exercise.id}
              onClick={() => handleSuggestionClick(exercise)}
              className={`w-full px-4 py-3 flex items-center justify-between hover:bg-white/10 transition-colors text-right ${
                index < suggestions.length - 1 ? 'border-b border-white/5' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--cosmos-accent-primary)]/20 flex items-center justify-center">
                  <span className="text-[var(--cosmos-accent-primary)] text-sm">🏋️</span>
                </div>
                <div>
                  <div className="text-white font-medium text-sm">{exercise.name ?? ''}</div>
                  <div className="text-white/40 text-xs">{muscleGroupLabels[exercise.muscleGroup ?? ''] || exercise.muscleGroup}</div>
                </div>
              </div>
              {(exercise.useCount || 0) >= 10 && (
                <span className="text-xs text-yellow-400">⭐ מועדף</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Quick Access: Favorites */}
      {favorites.length > 0 && !searchQuery && (
        <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
          <span className="text-xs text-white/30 self-center shrink-0">⭐</span>
          {favorites.map(ex => (
            <button
              key={ex.id}
              onClick={() => handleSuggestionClick(ex)}
              className="px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-xs font-medium whitespace-nowrap hover:bg-yellow-500/20 transition-colors"
            >
              {ex.name}
            </button>
          ))}
        </div>
      )}

      {/* Muscle Group Filters */}
      <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-2 mask-linear-fade">
        {muscleGroups.map(group => (
          <button
            key={group}
            onClick={() => onMuscleGroupChange(group)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap border ${
              selectedMuscleGroup === group
                ? 'bg-[var(--cosmos-accent-primary)] border-[var(--cosmos-accent-primary)] text-black shadow-[0_0_15px_rgba(34,211,238,0.3)]'
                : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:border-white/20'
            }`}
          >
            {muscleGroupLabels[group] || group}
          </button>
        ))}
      </div>
    </div>
  );
};
