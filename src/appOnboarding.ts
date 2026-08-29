import type { OnboardingData } from './pages/OnboardingFlow';
import { safeJsonParse } from './utils/safeJson';

// ============================================================================
// HELPER FUNCTIONS (defined outside App — no hooks)
// ============================================================================

// First-action deep link chosen from the data just collected.
// Everyone lands on home (FirstRunHero) — a guided "what to do next" surface —
// instead of a blank /workout which many users found confusing.
const TRAINEE_FIRST_ACTION = '/';

/**
 * The route a freshly-onboarded user should land on so onboarding ends in a
 * real first action instead of a static recap: the home FirstRunHero, with its
 * clear next-step guidance. Coach surfaces are reached via the server-assigned
 * role, never from onboarding.
 */
export function postOnboardingDestination(_data: OnboardingData): string {
  return TRAINEE_FIRST_ACTION;
}

/**
 * Pre-seed the browser path so that when the app's BrowserRouter mounts (right
 * after onboarding flips `onboardingDone`), it reads this location and lands on
 * the user's first action. Best-effort: a History API failure simply leaves the
 * default landing route, never blocking the finish.
 */
export function setPostOnboardingPath(path: string): void {
  try {
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState(null, '', path);
    }
  } catch {
    /* best-effort — fall back to the default landing route */
  }
}

export function getWeightGoalFromOnboarding(goal: string): string {
  switch (goal) {
    case 'strength':
    case 'muscle':
      return 'עלייה במסה';
    case 'weight_loss':
      return 'ירידה במשקל';
    default:
      return 'שמירה על משקל';
  }
}

// NOTE: there is deliberately no getActivityLevelFromOnboarding() any more.
// It mapped an EXPERIENCE self-report onto an ACTIVITY-VOLUME multiplier
// ('advanced' -> 'פעיל מאוד' -> 1.725), which is a category error even when the
// user answers: an experienced lifter who trains once a week is not very
// active. Its `default` branch additionally returned 'פעיל מתון' (1.55) for the
// empty case, so a user who answered nothing about activity was recorded as
// moderately active and every calorie target was built on it.
// activityLevel now has exactly one source: the user picking it directly in
// Settings › פרטים אישיים › רמת פעילות.

export function saveOnboardingData(data: OnboardingData) {
  localStorage.setItem('onboarding_data', JSON.stringify(data));
  localStorage.setItem('onboarding_completed', 'true');
  // Spread-merge onto any existing profile/prefs so re-running onboarding never
  // clobbers fields the user edited in Settings that onboarding doesn't cover.
  const existingProfile =
    safeJsonParse<Record<string, unknown>>(localStorage.getItem('user_profile')) ?? {};
  localStorage.setItem(
    'user_profile',
    JSON.stringify({
      ...existingProfile,
      name: data.name,
      age: data.age,
      height: data.height,
      weight: data.weight,
      gender: data.gender,
      weightGoal: getWeightGoalFromOnboarding(data.primaryGoal),
      // activityLevel is intentionally absent: onboarding never asks about
      // activity volume, so it has nothing truthful to write here.
    })
  );
  const existingPrefs =
    safeJsonParse<Record<string, unknown>>(localStorage.getItem('workout_prefs')) ?? {};
  localStorage.setItem(
    'workout_prefs',
    JSON.stringify({
      ...existingPrefs,
      autoStartRest: true,
      hapticsEnabled: true,
    })
  );
}

// A wizard field counts as "filled" when it's neither the empty-string sentinel
// (the OnboardingData default for unset text/number/select fields) nor null.
function isFilled(value: unknown): boolean {
  return value !== '' && value !== null && value !== undefined;
}

// Persist only the fields the user actually filled in before skipping. Unlike
// saveOnboardingData this never writes empty sentinels into the saved profile,
// so a half-completed wizard yields a partial — but truthful — profile that the
// user can finish in Settings later (the skip dialog's promise).
export function savePartialOnboardingData(data: OnboardingData) {
  // Keep the raw draft so re-entering onboarding / hydration can resume it.
  localStorage.setItem('onboarding_data', JSON.stringify(data));

  const profile: Record<string, unknown> = {};
  if (isFilled(data.name)) profile.name = data.name;
  if (isFilled(data.age)) profile.age = data.age;
  if (isFilled(data.height)) profile.height = data.height;
  if (isFilled(data.weight)) profile.weight = data.weight;
  if (isFilled(data.gender)) profile.gender = data.gender;
  if (isFilled(data.primaryGoal)) {
    profile.weightGoal = getWeightGoalFromOnboarding(data.primaryGoal);
  }
  // No activityLevel here either. This path was already the honest one for the
  // EMPTY case (it wrote only when experienceLevel was filled), but the
  // experience -> activity derivation it used was wrong whether or not the user
  // answered, so the whole write is gone rather than guarded.

  // Merge onto any existing profile so we never clobber previously saved values
  // with nothing — immutable build, single write.
  if (Object.keys(profile).length > 0) {
    const existing = safeJsonParse<Record<string, unknown>>(localStorage.getItem('user_profile'));
    localStorage.setItem('user_profile', JSON.stringify({ ...(existing ?? {}), ...profile }));
  }
}
