// ============================================================================
// SPARKOS FITNESS - Analytics Service
// ============================================================================
//
// Public entry point. Implementations live in cohesive sub-modules under
// `./analytics/` and are re-exported here so existing imports from
// `.../analyticsService` keep working unchanged.

// Weekly volume, muscle balance, forecast, exercise progress
export * from './analytics/volumeMetrics';

// useFitnessInsights hook helpers (last workout, days-since, week-over-week, strength)
export * from './analytics/insights';
