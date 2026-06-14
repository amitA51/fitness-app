// ExerciseFilter - Fresh Steel / Obsidian
// Surface background · ink text · sharp corners · IBM Plex Mono labels
// VISION: Bold · Editorial · Confident · Narrative · Printed

import { Search as SearchIcon } from 'lucide-react';
import type React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MUSCLE_GROUPS } from '../../../constants';
import type { PersonalExercise } from '../../../types';
import { CustomDumbbellIcon as DumbbellIcon } from '../../icons/CustomDumbbellIcon';

const MUSCLE_LABELS: Record<string, string> = {
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

interface ExerciseFilterProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedMuscleGroup: string;
  onMuscleGroupChange: (group: string) => void;
  exercises?: PersonalExercise[];
  onSuggestionSelect?: (exercise: PersonalExercise) => void;
}

const ExerciseFilter: React.FC<ExerciseFilterProps> = ({
  searchQuery,
  onSearchChange,
  selectedMuscleGroup,
  onMuscleGroupChange,
  exercises = [],
  onSuggestionSelect,
}) => {
  const muscleGroups = Object.values(MUSCLE_GROUPS);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Favorites (most used)
  const favorites = exercises
    .filter((ex) => (ex.useCount || 0) >= 5)
    .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
    .slice(0, 5);

  // Search suggestions are pure derived state — compute them inline instead of
  // mirroring searchQuery/exercises into a useState via an effect.
  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const query = searchQuery.toLowerCase();
    return exercises
      .filter(
        (ex) =>
          ex.name?.toLowerCase().includes(query) || ex.muscleGroup?.toLowerCase().includes(query)
      )
      .sort((a, b) => {
        const aExact = a.name?.toLowerCase().startsWith(query);
        const bExact = b.name?.toLowerCase().startsWith(query);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return (b.useCount || 0) - (a.useCount || 0);
      })
      .slice(0, 6);
  }, [searchQuery, exercises]);

  // Close on outside click
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
    <div ref={containerRef} style={{ padding: '0 5px 12px' }}>
      {/* Search Input */}
      <div className="relative" style={{ marginBottom: 12 }}>
        <SearchIcon
          className="absolute end-4 top-1/2 -translate-y-1/2 w-5 h-5"
          style={{ color: 'var(--fs-muted)' }}
        />
        <input
          ref={inputRef}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          aria-label="חיפוש תרגיל"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          value={searchQuery}
          onChange={(e) => {
            onSearchChange(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => searchQuery.length >= 2 && setShowSuggestions(suggestions.length > 0)}
          placeholder="חיפוש תרגיל…"
          className="w-full"
          style={{
            background: 'var(--fs-surface)',
            border: '2px solid var(--fs-primary)',
            borderRadius: 0,
            padding: '12px 44px 12px 44px',
            fontFamily: 'var(--font-body)',
            fontSize: 16 /* 16px prevents iOS auto-zoom */,
            color: 'var(--fs-ink)',
            outline: 'none',
            direction: 'rtl',
            textAlign: 'start',
          }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              inputRef.current?.focus();
            }}
            className="absolute start-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center cursor-pointer"
            style={{
              background: 'var(--fs-surface-2)',
              borderRadius: 0,
              color: 'var(--fs-muted)',
            }}
            aria-label="נקה חיפוש"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              aria-hidden="true"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            left: 20,
            right: 20,
            top: '100%',
            marginTop: 4,
            background: 'var(--fs-surface)',
            border: '2px solid var(--fs-primary)',
            zIndex: 60,
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {suggestions.map((exercise, index) => (
            <button
              type="button"
              key={exercise.id}
              onClick={() => handleSuggestionClick(exercise)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '10px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom:
                  index < suggestions.length - 1 ? '1px solid var(--fs-surface-2)' : 'none',
                cursor: 'pointer',
                textAlign: 'right',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    background: 'var(--fs-surface-2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <DumbbellIcon className="w-4 h-4" style={{ color: 'var(--fs-heading)' }} />
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 14,
                      color: 'var(--fs-heading)',
                      textAlign: 'right',
                    }}
                  >
                    {exercise.name ?? ''}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      color: 'var(--fs-muted)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {MUSCLE_LABELS[exercise.muscleGroup ?? ''] || exercise.muscleGroup}
                  </div>
                </div>
              </div>
              {(exercise.useCount || 0) >= 10 && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    letterSpacing: '0.2em',
                    color: 'var(--fs-accent)',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  מועדף
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Favorites */}
      {favorites.length > 0 && !searchQuery && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 8,
            direction: 'rtl',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.2em',
              color: 'var(--fs-accent)',
              textTransform: 'uppercase',
              alignSelf: 'center',
              flexShrink: 0,
            }}
          >
            מועדפים
          </span>
          {favorites.map((ex) => (
            <button
              type="button"
              key={ex.id}
              onClick={() => handleSuggestionClick(ex)}
              style={{
                padding: '4px 12px',
                background: 'var(--fs-accent)',
                // ink-on-accent: --fs-heading fails AA on the mint fill in dark.
                color: 'var(--color-ink-on-accent)',
                border: 'none',
                borderRadius: 0,
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {ex.name}
            </button>
          ))}
        </div>
      )}

      {/* Muscle Group Pills */}
      <div
        className="no-scrollbar"
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 4,
          direction: 'rtl',
          // Hide the scrollbar but keep horizontal scrolling (Firefox + IE/Edge).
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          maskImage: 'linear-gradient(to left, black 90%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to left, black 90%, transparent 100%)',
        }}
      >
        {muscleGroups.map((group) => {
          const isActive = selectedMuscleGroup === group;
          return (
            <button
              type="button"
              key={group}
              onClick={() => onMuscleGroupChange(group)}
              style={{
                padding: '6px 14px',
                background: isActive ? 'var(--fs-primary)' : 'var(--fs-surface-2)',
                color: isActive ? 'var(--fs-surface)' : 'var(--fs-muted)',
                border: isActive ? 'none' : '1px solid var(--color-border)',
                borderRadius: 0,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'all 150ms',
              }}
            >
              {MUSCLE_LABELS[group] || group}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export { ExerciseFilter };
export default ExerciseFilter;
