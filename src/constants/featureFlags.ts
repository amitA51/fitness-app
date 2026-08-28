// ============================================================================
// featureFlags — product decisions that are still OPEN, written down as code.
//
// A flag lives here only while a real decision is pending. It is not a config
// system and there is no UI for it: the seam is the constant below, flipped by
// hand in a one-line commit.
// ============================================================================

/**
 * NUTRITION_TRAINEE_UI_ENABLED — should the trainee-facing nutrition screen be
 * part of the product right now?
 *
 * `false` today, and that is a DECISION, not a bug and not a half-finished
 * migration. The app owner has not decided whether the nutrition feature stays:
 * he does not consider it effective enough to keep investing time in, so the
 * trainee surface is de-prioritized and kept out of sight WHILE THE DECISION IS
 * OPEN. If you are reading this in three months and the screen is still hidden,
 * the question simply has not been answered yet — nothing here is broken, and
 * nothing was deleted.
 *
 * What this flag hides, and only this (trainee side):
 *   • the תזונה tab in the bottom navigation (components/ui/BottomNav.tsx)
 *   • the /nutrition route (AppRouter.tsx `NutritionGuard`), which redirects
 *     home for everyone EXCEPT a member of app_admins. Admin access is part of
 *     the point: the owner cannot decide the fate of a screen he cannot open.
 *   • the one line of copy in pages/MyCoach.tsx that told trainees their
 *     nutrition targets are shown "in the nutrition screen".
 *
 * What is deliberately LEFT UNTOUCHED, and why:
 *   • The data layer. nutritionService, the IndexedDB stores, offlineQueue and
 *     the Supabase sync keep reading and writing nutrition logs exactly as
 *     before. Hidden UI over live data is reversible; hidden UI over dead sync
 *     would silently lose the history the owner needs if he keeps the feature.
 *   • The coach side. A coach still reads and edits a trainee's nutrition logs
 *     in Client 360 — that is a legitimate, separate surface, out of scope here.
 *   • The nutrition pages, components and their tests. All still in the repo,
 *     still compiled, still covered. Hidden means unreachable, not gone.
 *
 * TO BRING THE FEATURE BACK, flip the single line at the bottom of this file:
 *
 *     export const NUTRITION_TRAINEE_UI_ENABLED = false;   ->   = true;
 *
 * Nothing else has to change: the tab reappears for everyone and /nutrition
 * stops redirecting. To drop the feature instead, delete this flag and every
 * surface it is imported into.
 */
export const NUTRITION_TRAINEE_UI_ENABLED = false;
