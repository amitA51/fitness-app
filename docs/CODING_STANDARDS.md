# SparkOS Fitness App - Coding Standards

## Overview

This document defines the coding standards and best practices for the SparkOS Fitness App project.

## Project Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase
- **State**: use-immer (Immer + React hooks)
- **Animations**: Framer Motion
- **Icons**: Lucide React

---

## 1. File Organization

### Directory Structure

```
src/
├── components/       # Reusable UI components
│   ├── ui/          # Base UI (Button, Input, Card)
│   ├── forms/       # Form components
│   └── layouts/     # Layout components
├── contexts/         # React Context providers
├── hooks/           # Custom React hooks
├── lib/             # Utilities, API clients, configs
│   ├── api/         # API functions
│   ├── utils/       # Helper functions
│   └── constants/   # App constants
├── pages/           # Page components (route views)
├── services/         # Business logic services
├── styles/          # Global styles, Tailwind extensions
├── types/           # TypeScript type definitions
├── data/            # Static data
├── errors/          # Error handling utilities
└── App.tsx          # Root component
```

### File Naming

| Type | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `WorkoutCard.tsx` |
| Hooks | camelCase + `use` prefix | `useWorkout.ts` |
| Utils | camelCase | `formatDate.ts` |
| Types | camelCase + `.types` suffix | `workout.types.ts` |
| Constants | SCREAMING_SNAKE | `ROUTES.ts` |

---

## 2. TypeScript Standards

### Interfaces vs Types

```typescript
// ✅ Use Interface for object shapes
interface Workout {
  id: string;
  name: string;
  exercises: Exercise[];
  createdAt: Date;
}

// ✅ Use Type for unions, complex types
type WorkoutStatus = 'draft' | 'active' | 'completed';
type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

// ❌ Don't use Interface for simple aliases
type UserId = string;
```

### Strict Mode Rules

```typescript
// ✅ Always define proper types
function calculateCalories(workout: Workout): number {
  return workout.exercises.reduce((total, ex) => {
    return total + (ex.sets * ex.reps * ex.weight * 0.04);
  }, 0);
}

// ❌ Never use any
function processData(data: any) { // ❌
  return data.value;
}
```

---

## 3. React Patterns

### Component Structure

```typescript
import { useState, useCallback } from 'react';
import type { FC } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

// ✅ Define interfaces for props
interface WorkoutCardProps {
  workout: Workout;
  onSelect: (id: string) => void;
  isSelected?: boolean;
}

// ✅ Use functional component with proper typing
export const WorkoutCard: FC<WorkoutCardProps> = ({
  workout,
  onSelect,
  isSelected = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // ✅ Memoize handlers when passed to children
  const handleSelect = useCallback(() => {
    onSelect(workout.id);
  }, [onSelect, workout.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card ${isSelected ? 'ring-2 ring-primary' : ''}`}
    >
      <h3 onClick={handleSelect}>{workout.name}</h3>
    </motion.div>
  );
};
```

### Hook Usage

```typescript
// ✅ Custom hook pattern
export function useWorkout(workoutId: string) {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetchWorkout(workoutId)
      .then(setWorkout)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [workoutId]);

  return { workout, loading, error };
}

// ✅ Return object for named destructuring
return { workout, loading, error };
```

### State Management

```typescript
// ✅ Prefer Immer for immutable updates
import { useImmer } from 'use-immer';

const [workouts, updateWorkouts] = useImmer<Workout[]>([]);

// Add item
updateWorkouts((draft) => {
  draft.push(newWorkout);
});

// Update item
updateWorkouts((draft) => {
  const workout = draft.find((w) => w.id === id);
  if (workout) {
    workout.name = newName;
  }
});
```

---

## 4. API & Data Fetching

### API Structure

```typescript
// lib/api/workouts.ts
export async function getWorkouts(): Promise<Workout[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('*, exercises(*)');

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createWorkout(workout: CreateWorkoutInput): Promise<Workout> {
  const { data, error } = await supabase
    .from('workouts')
    .insert(workout)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}
```

---

## 5. Error Handling

### Error Boundaries

```typescript
// errors/ErrorBoundary.tsx
import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <DefaultError />;
    }
    return this.props.children;
  }
}
```

---

## 6. Performance

### When to Use Memoization

| Scenario | Tool |
|----------|------|
| Expensive calculations | `useMemo` |
| Stable callback references | `useCallback` |
| Stable object/array props | `React.memo` |
| Large list rendering | Virtualization |

### Code Splitting

```typescript
// Lazy load heavy components
const NutritionChart = lazy(() => import('./NutritionChart'));

function Dashboard() {
  return (
    <Suspense fallback={<Skeleton />}>
      <NutritionChart />
    </Suspense>
  );
}
```

---

## 7. Testing

### Test Structure (AAA Pattern)

```typescript
describe('WorkoutCard', () => {
  it('displays workout name', () => {
    // Arrange
    const workout = createMockWorkout({ name: 'Push Day' });

    // Act
    render(<WorkoutCard workout={workout} onSelect={jest.fn()} />);

    // Assert
    expect(screen.getByText('Push Day')).toBeInTheDocument();
  });

  it('calls onSelect when clicked', () => {
    const onSelect = jest.fn();
    render(<WorkoutCard workout={mockWorkout} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onSelect).toHaveBeenCalledWith(mockWorkout.id);
  });
});
```

---

## 8. Commit Messages

Follow Conventional Commits:

```
feat(workout): add exercise selection
fix(nutrition): correct calorie calculation
docs(readme): update installation guide
style(tailwind): update color scheme
refactor(api): simplify workout fetch
test(workout): add unit tests
```

---

## 9. Linting & Formatting

### Commands

```bash
# Format all files
npm run format

# Lint all files
npm run lint

# Type check
npm run typecheck

# Run all checks before commit
npm run verify
```

### VSCode Settings (Recommended)

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports.biome": "explicit"
  },
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  }
}
```

---

## 10. Accessibility

- Use semantic HTML elements
- Provide alt text for images
- Use proper heading hierarchy (h1 → h2 → h3)
- Ensure keyboard navigation
- Test with screen readers
- Maintain color contrast ratios

---

## Summary

| Category | Key Rule |
|----------|----------|
| Types | No `any`, use interfaces for objects |
| Components | Small, focused, typed props |
| State | Immer for immutable updates |
| Hooks | Custom hooks for reusable logic |
| API | Async/await with error handling |
| Performance | Profile before optimizing |
| Testing | AAA pattern, test behavior |
