// ExerciseFilter - Sport Annual Editorial Design
// Bone background · Navy text · Sharp corners · IBM Plex Mono labels
// VISION: Bold · Editorial · Confident · Narrative · Printed

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { MUSCLE_GROUPS } from '../../../constants';
import type { PersonalExercise } from '../../../types';
import { SearchIcon } from '../../icons';

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
  const [suggestions, setSuggestions] = useState<PersonalExercise[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Favorites (most used)
  const favorites = exercises
    .filter((ex) => (ex.useCount || 0) >= 5)
    .sort((a, b) => (b.useCount || 0) - (a.useCount || 0))
    .slice(0, 5);

  // Search suggestions
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const query = searchQuery.toLowerCase();
    const matches = exercises
      .filter(
        (ex) =>
          ex.name?.toLowerCase().includes(query) ||
          ex.muscleGroup?.toLowerCase().includes(query)
      )
      .sort((a, b) => {
        const aExact = a.name?.toLowerCase().startsWith(query);
        const bExact = b.name?.toLowerCase().startsWith(query);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return (b.useCount || 0) - (a.useCount || 0);
      })
      .slice(0, 6);
    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
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
          className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5"
          style={{ color: 'var(--stone)' }}
        />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={() => searchQuery.length >= 2 && setShowSuggestions(suggestions.length > 0)}
          placeholder="חיפוש תרגיל..."
          className="w-full"
          style={{
            background: '#FFFFFF',
            border: '2px solid var(--navy)',
            borderRadius: 0,
            padding: '12px 44px 12px 44px',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            color: 'var(--ink)',
            outline: 'none',
            direction: 'rtl',
            textAlign: 'right',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => {
              onSearchChange('');
              inputRef.current?.focus();
            }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center cursor-pointer"
            style={{
              background: 'var(--bone-deep)',
              borderRadius: 0,
              color: 'var(--stone)',
            }}
            aria-label="נקה חיפוש"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
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
            background: '#FFFFFF',
            border: '2px solid var(--navy)',
            zIndex: 60,
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {suggestions.map((exercise, index) => (
            <button
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
                  index < suggestions.length - 1 ? '1px solid var(--bone-deep)' : 'none',
                cursor: 'pointer',
                textAlign: 'right',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    background: 'var(--bone-deep)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <DumbbellIcon className="w-4 h-4" style={{ color: 'var(--navy)' }} />
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 800,
                      fontSize: 14,
                      color: 'var(--navy)',
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
                      color: 'var(--stone)',
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
                    color: 'var(--mustard)',
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
              color: 'var(--mustard)',
              textTransform: 'uppercase',
              alignSelf: 'center',
              flexShrink: 0,
            }}
          >
            ⭐
          </span>
          {favorites.map((ex) => (
            <button
              key={ex.id}
              onClick={() => handleSuggestionClick(ex)}
              style={{
                padding: '4px 12px',
                background: 'var(--mustard)',
                color: 'var(--navy)',
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
        style={{
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          paddingBottom: 4,
          direction: 'rtl',
          maskImage: 'linear-gradient(to left, black 90%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to left, black 90%, transparent 100%)',
        }}
      >
        {muscleGroups.map((group) => {
          const isActive = selectedMuscleGroup === group;
          return (
            <button
              key={group}
              onClick={() => onMuscleGroupChange(group)}
              style={{
                padding: '6px 14px',
                background: isActive ? 'var(--navy)' : 'var(--bone-deep)',
                color: isActive ? 'var(--bone)' : 'var(--stone)',
                border: isActive ? 'none' : '1px solid rgba(20,41,61,0.15)',
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

// Inline DumbbellIcon to avoid circular import
const DumbbellIcon = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg
    className={className}
    style={style}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M19 11a7.5 7.5 0 01-3.5 13M19 11h-5m5 0a7.5 7.5 0 00-7.5-7.5m7.5 7.5V5.5a2.5 2.5 0 00-5 0V11m-9.5 7h4.5m-4.5 0a7.5 7.5 0 017-5.5m0 0H9m2.5 0V5.5a2.5 2.5 0 00-5 0V11m2.5 0h-2.5m2.5 0a7.5 7.5 0 017 5.5"
    />
  </svg>
);

export { ExerciseFilter };
export default ExerciseFilter;
