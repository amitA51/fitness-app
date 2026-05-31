// Components index - Clean exports
export { default as SetInputCard } from './SetInputCard';
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

// Bottom sheets & overlays
export { default as AlternativesSheet } from './AlternativesSheet';
export { default as NotesBottomSheet } from './NotesBottomSheet';
export { default as RPEPicker } from './RPEPicker';
export { default as SlideToComplete } from './SlideToComplete';
export { default as InlineRestTimer } from './InlineRestTimer';
export { default as SetTechniquePills } from './SetTechniquePills';

// Stats & charts
export { SetProgress } from './SetProgress';
export { StatsGrid } from './StatsGrid';
export { SummaryExerciseList } from './SummaryExerciseList';
export { PRHighlights } from './PRHighlights';
export { default as MuscleRadarChart } from './MuscleRadarChart';
export { default as TrendLineOverlay } from './TrendLineOverlay';

// Handlers & hooks
export { WaterReminderHandler } from './WaterReminderHandler';
export { default as WorkoutAriaLive } from './WorkoutAriaLive';
export { default as useWorkoutFinish } from './WorkoutActions';
export { default as useExerciseSuggestions } from './ExerciseSuggestionLoader';
