# Phase 1: Critical Fixes — Implementation Plan

## Task 1: Remove Client-Side API Key
**File:** `src/services/ai/bootstrap.ts`
- Remove `VITE_DEEPSEEK_API_KEY` env var usage
- Route all AI calls through the Supabase Edge Function instead of direct API calls
- Update `src/services/ai/config.ts` if it references the key
- Ensure the Edge Function handles authentication

## Task 2: Fix Reducer Routing Bugs
**File:** `src/components/workout/core/workoutReducer.ts`
- Find the action-to-slice routing Sets (maps action types to reducer slices)
- Add `TOGGLE_PAUSE` to the timer slice Set
- Add missing modal actions to the modal slice Set
- Verify all action types are properly routed

## Task 3: Delete Dead Code — recoveryService.ts
**File:** `src/services/recoveryService.ts`
- Verify no imports reference this file
- Delete the file
- Remove any re-exports from barrel files if they exist

## Task 4: Sync Model Lists
**Files:** `src/services/ai/config.ts`, `supabase/functions/ai-chat/index.ts`
- Ensure `AI_DEFAULT_MODEL` in config.ts matches a model in the Edge Function's `ALLOWED_MODELS`
- OR add the client's default model to the Edge Function's allowlist
- The Edge Function should be the source of truth

## Task 5: Fix PWA Manifest
**File:** `public/manifest.webmanifest`
- Fix invalid `"any maskable"` purpose value
- Remove duplicate icon entry
- Fix theme color to match `index.html`
- Update placeholder URLs

## Task 6: Delete Backup File
**File:** `src/services/workoutDb.ts.bak`
- Delete this file (should not be in repo)
- Add `*.bak` to `.gitignore` if not already there
