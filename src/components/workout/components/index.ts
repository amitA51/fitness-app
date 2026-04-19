// Components index - Clean exports
export { default as SetInputCard } from './SetInputCard';
export { default as SwipeComplete } from './SwipeComplete';
export { default as WorkoutHeader } from './WorkoutHeader';
export { default as ExerciseDisplay } from './ExerciseDisplay';
export { default as ExerciseNav } from './ExerciseNav';
export { default as ProgressBar } from './ProgressBar';
export { default as SetEditBottomSheet } from './SetEditBottomSheet';
export { default as IntensityMeter, ZONES, getZoneFromIntensity } from './IntensityMeter';
export {
  default as PerformanceAnalytics,
  calculateVolume,
  formatDuration,
} from './PerformanceAnalytics';

// Exercise Library components (refactored for cleaner code)
export { ExerciseFilter } from './ExerciseFilter';
export { ExerciseForm, AddExerciseButton } from './ExerciseForm';
export { ExerciseCard } from './ExerciseCard';
export { ExerciseList } from './ExerciseList';
export { DeleteConfirmDialog } from './DeleteConfirmDialog';
