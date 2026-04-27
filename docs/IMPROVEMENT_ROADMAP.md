# SparkOS Fitness -- Improvement & Upgrade Roadmap

> Comprehensive list of improvements, upgrades, and new features to transform SparkOS Fitness into a top-tier fitness application. Organized by area with priority levels.

---

## 1. WORKOUT EXPERIENCE

### Current State
- Full workout flow with exercises, sets, reps, weight logging
- Rest timer with auto-start, pause/resume, +15/+30/+60s adjustments
- RPE tracking per set (`UPDATE_SET_RPE` action in `workoutReducer.ts`)
- Notes per set (`UPDATE_SET_NOTES`, `NotesBottomSheet.tsx`)
- Ghost values from previous workout for comparison
- Stopwatch with pause tracking (`startTimestamp`, `totalPausedTime`)
- PR celebrations with confetti and haptics (`PRCelebration.tsx`)
- AI Coach integration (`AICoach.tsx`)
- Warmup/cooldown flow (`WarmupCooldownFlow.tsx`)
- Exercise reorder via drag (`ExerciseReorder.tsx`)

### Missing / Improvements

#### Critical
- [ ] **Plate Calculator** -- For barbell exercises, show which plates to load. E.g., "Load 20+10+5 on each side for 80kg". Should use the user's available plates inventory from settings.
- [ ] **Exercise Substitution Mid-Workout** -- Allow swapping an exercise while keeping set history intact. Needs `SUBSTITUTE_EXERCISE` action in `workoutReducer.ts`. Use case: machine is occupied, swap to alternative.

#### High
- [ ] **Drop Sets** -- Add `isDropSet` flag to `WorkoutSet` type. Allow logging weight reduction within same set. Common in bodybuilding.
- [ ] **Timed Exercises UI** -- `WorkoutSet` has `isTimed` field but no UI. Add a timer mode for planks, carries, dead hangs, isometric holds.
- [ ] **Warm-up Calculator (% of 1RM)** -- Auto-calculate warm-up sets based on working weight. E.g., 50%x5, 70%x3, 85%x1 before 100%x5 working sets. Reference `WarmupCooldownFlow.tsx`.
- [ ] **Rest Timer Between Exercises** -- Configurable rest period when moving from one exercise to the next. Separate from between-set rest.
- [ ] **Auto-Complete Set** -- When user logs a set matching the target reps, auto-mark as complete and start rest timer. Reduces tapping.

#### Medium
- [ ] **Superset/Circuit Timer** -- While `enableSupersets` setting exists, add dedicated circuit timer that rotates between exercises with rest-between-rounds.
- [ ] **Failure Marker** -- Mark sets where the user failed to complete target reps. Track failure rate over time for deload decisions.
- [ ] **Quick Weight Buttons** -- `enableQuickWeightButtons` setting exists but verify UI is polished. Should show -2.5/-5/+2.5/+5 buttons based on exercise type.
- [ ] **Vibration Patterns** -- Different haptic patterns for: set complete, rest timer done, PR achieved, workout complete. More informative than single buzz.
- [ ] **Countdown Before Set** -- 3-2-1 countdown with audio beep when user is about to start a set, especially for timed exercises.
- [ ] **Exercise Rest History** -- Show how long the user rested between each set in previous workouts for comparison.

#### Creative / Premium
- [ ] **Voice Coach Mode** -- Text-to-speech announcements: "Set complete. Rest 90 seconds.", "30 seconds remaining.", "New personal record!". Use `voiceCountdownEnabled` setting.
- [ ] **Gym Mode** -- Full-screen black background with large white text, gesture-controlled (swipe left = next set, swipe right = previous). `gymModeEnabled` setting exists.
- [ ] **Workout Templates from AI** -- Let AI coach generate complete workout templates based on user's goals, available equipment, and recovery state.
- [ ] **Partner/Superset Detection** -- If user consistently pairs two exercises with minimal rest, suggest creating a superset automatically.

---

## 2. EXERCISE DATABASE

### Current State
- ~90 built-in exercises in `src/data/builtInExercises.ts` covering: Chest (14), Back (13), Shoulders (10), Legs/Quads (12), Hamstrings/Glutes (11), Calves (4), Triceps (8), Biceps (9), Core (9), Cardio (2)
- Hebrew names with English translations
- Custom exercises via `QuickExerciseForm.tsx`
- Exercise selector with search/filter (`ExerciseSelector/index.tsx`)
- Exercise tutorials with text descriptions (`ExerciseTutorial.tsx`)
- `PersonalExercise` type has `secondaryMuscles`, `equipment`, `videoUrl`, `imageUrl` fields

### Missing / Improvements

#### Critical
- [x] **Equipment Tagging** -- Add `equipment` field population to all built-in exercises: barbell, dumbbell, cable, machine, bodyweight, band, kettlebell. Enable filter by available equipment.
- [x] **Secondary Muscles Population** -- `secondaryMuscles` field exists in type but is empty in data. Populate for all 90 exercises. E.g., Bench Press: primary=Chest, secondary=Triceps, Shoulders.

#### High
- [ ] **Exercise Animations/videos** -- `videoUrl`/`imageUrl` fields exist. Add exercise demonstration GIFs or short videos. Could use free sources like MuscleWiki or custom recordings.
- [ ] **Exercise Variations** -- Group exercises by "family". E.g., "Bench Press" family includes: flat barbell, incline barbell, flat dumbbell, incline dumbbell, decline, close-grip. Make swapping within family easy.
- [ ] **Difficulty Rating** -- Add beginner/intermediate/advanced rating to each exercise. Filter exercises by user's experience level.
- [ ] **Muscle Map / Body Map UI** -- Interactive body diagram where user taps a muscle group to see exercises. Much more intuitive than text lists for beginners.

#### Medium
- [ ] **Exercise Instructions with Form Tips** -- Expand tutorial text with common mistakes, setup cues, and form tips per exercise.
- [ ] **Expand to 200+ Exercises** -- Current 90 is good but missing: hip thrusts, landmine press, face pulls, cable flyes, leg press, hack squat, Romanian deadlift variations, overhead press variations.
- [ ] **Exercise Substitution Suggestions** -- When user can't do an exercise, suggest alternatives that target the same muscles with the same or different equipment.

#### Creative / Premium
- [ ] **AI Exercise Analysis** -- Using camera (long-term), analyze form and provide real-time feedback on squat depth, bench press arch, etc.
- [ ] **User-Generated Exercise Library** -- Allow community to submit exercises with descriptions and videos, curated by moderators.
- [ ] **Equipment-Based Workout Generator** -- "I only have dumbbells and a bench, give me a chest workout." Filter and generate workouts from available equipment.

---

## 3. PROGRESS TRACKING

### Current State
- Body weight tracking with 7-day bar chart in `Progress.tsx`
- Body measurements (chest, waist, hips, arms, thighs, neck)
- Recovery tracking (sleep, soreness, energy, stress)
- BMI calculation with category
- Weight trend direction (up/down/stable)
- Improvement score (weekly volume/frequency/duration change)
- Personal records with celebration
- Analytics dashboard with muscle distribution
- Workout streak (added in recent update)
- Recent PR banner (added in recent update)
- Muscle frequency tracker (added in recent update)

### Missing / Improvements

#### Critical
- [ ] **Progress Photos** -- Camera/gallery integration to capture photos. Side-by-side comparison view with date slider. Most powerful motivation tool in any fitness app. Files needed: `src/components/progress/ProgressPhotos.tsx`, `src/services/progressPhotoService.ts`.
- [x] **Strength Progress Curves in Progress Page** -- `Progress.tsx` has weight/measurements/recovery tabs but no strength tab. Add line chart showing weight x reps for top exercises over time. The `AnalyticsDashboard.tsx` has volume history but it's separate.

#### High
- [ ] **Date Range Selector** -- All charts use fixed ranges (7-day, 30-day). Add selector: 1W / 1M / 3M / 6M / 1Y / ALL.
- [ ] **Goal Weight Line on Weight Chart** -- Settings stores `weightGoal` but chart doesn't show target line. Add horizontal dashed line showing goal weight with projected achievement date.
- [ ] **Trend Line / Regression** -- Add moving average or linear regression to weight chart. Show projected weight in 30 days based on current trend.
- [ ] **Body Composition Estimation** -- From measurements (waist, neck, height) estimate body fat percentage using Navy method formula. Already have all inputs.
- [ ] **Muscle Group Strength Progress** -- Per muscle group, show strength progression over time. "Your chest exercises are up 12% this month".

#### Medium
- [ ] **Before/After Photo Comparison** -- Overlay slider to compare any two dates of progress photos.
- [ ] **Measurement Delta Cards** -- Show change from previous measurement with arrow indicators. "Waist: -2cm from last month".
- [ ] **Workout Volume Charts** -- Weekly/monthly volume chart by muscle group. Show if volume is increasing over time (key for hypertrophy).
- [ ] **Estimated 1RM History** -- Track estimated 1RM for key lifts over time. Already have Epley formula in PR service.
- [ ] **Calendar Heatmap** -- GitHub-style calendar showing workout intensity by day. Visual consistency tracker.

#### Creative / Premium
- [ ] **AI Progress Insights** -- "Your bench press has plateaued for 3 weeks. Consider a deload week or switching to dumbbell press for variety."
- [ ] **Achievement Milestones** -- "First 100kg squat", "30 consecutive workout days", "1000 total sets logged". Badge system with shareable cards.
- [ ] **Injury Tracking** -- Log injuries/pain areas. Correlate with exercises to identify problematic movements. Warn before loading injured areas.
- [ ] **Periodization Phases** -- Track which training phase user is in (hypertrophy, strength, peaking, deload) and show appropriate metrics per phase.

---

## 4. NUTRITION

### Current State
- Macro tracking (calories, protein, carbs, fat) with daily goals
- ~40 hardcoded Israeli/Mediterranean foods in `nutritionService.ts`
- Meal logging by type (breakfast/lunch/dinner/snack/pre-workout/post-workout)
- Meal presets for quick logging
- Food search over hardcoded library
- Water tracking (added in recent update) with `waterService.ts`
- TDEE calculator (added in recent update) with `tdee.ts`

### Missing / Improvements

#### Critical
- [ ] **Expand Food Database to 200+ Items** -- Current ~40 items is insufficient for real-world use. Add common Israeli foods: labneh, zaatar, pita varieties, shakshuka ingredients, Israeli salads, protein bars, common restaurant meals, fruits, vegetables, dairy products.
- [ ] **Custom Food Creation** -- UI for users to create their own food entries with custom macro values. Store in IndexedDB. Critical because no database can cover everyone's diet.

#### High
- [ ] **Barcode Scanner** -- Camera integration to scan food barcodes. Look up nutritional info from open food database (Open Food Facts API is free). File needed: `src/components/nutrition/BarcodeScanner.tsx`.
- [x] **Fiber Tracking** -- `FoodItem` type has `fiber` field but it's not shown in daily totals. Add fiber to macro display and daily tracking.
- [ ] **Meal History by Date** -- View past days' meals. Useful for replicating successful eating days. Currently only shows today.
- [ ] **Macro Targets from TDEE** -- TDEE calculator exists but isn't auto-linked to nutrition goals. Should auto-populate daily macro targets based on profile + goal.

#### Medium
- [ ] **Serving Size Calculator** -- When logging food, let user enter weight in grams and auto-calculate macros. Currently only supports fixed serving sizes.
- [ ] **Recipe Builder** -- Combine multiple foods into a reusable recipe with total macros. E.g., "My Protein Oatmeal" = oats + protein powder + milk + banana.
- [ ] **Meal Planning (Future)** -- Plan meals for tomorrow/week ahead. Pre-log meals and adjust as you go.
- [ ] **Water Intake History** -- Show 7-day water intake chart. Currently only shows today's total.
- [ ] **Caffeine Tracking** -- Log coffee/tea intake. Important for sleep quality correlation with recovery data.
- [ ] **Alcohol Tracking** -- Log alcohol consumption. Affects recovery and calorie goals.

#### Creative / Premium
- [ ] **AI Meal Suggestions** -- Based on remaining macros for the day, suggest meals that fit. "You need 40g more protein and 50g carbs. Consider: chicken breast with rice."
- [ ] **Photo Food Logging** -- Take photo of meal, AI estimates macros. Reduces friction in logging.
- [ ] **Intermittent Fasting Timer** -- Track eating windows. Show when in fasting vs. feeding state. Correlate with energy levels.
- [ ] **Grocery List Generator** -- From meal plan or logged meals, generate shopping list. Share to notes apps.
- [ ] **Restaurant Meal Database** -- Common Israeli restaurant chain meals with estimated macros.

---

## 5. RECOVERY

### Current State
- Sleep tracking (hours + quality 1-5)
- Soreness, energy, stress levels (1-5 each)
- Composite recovery score (0-100) with weighted formula
- Tight areas body mapping (14 body areas)
- Weekly averages for all recovery metrics
- 7-day recovery log history with color coding

### Missing / Improvements

#### Critical
- [ ] **Recovery-to-Workout Integration** -- Recovery score should influence workout recommendations. If recovery < 40, suggest lighter workout or rest day. If > 80, suggest pushing harder. Connect `recoveryService.ts` output to `progressionService.ts` input.

#### High
- [ ] **Sleep Trends Chart** -- Visual line chart of sleep hours over 7/30 days. Currently only shows weekly average number.
- [ ] **Auto-Recovery Prompts** -- After a heavy leg day (detected from exercise data), automatically prompt recovery logging. "How are your legs feeling today?"
- [ ] **Cumulative Fatigue Score** -- Track training load over time and calculate fatigue. Combine volume, intensity, and recovery data. Warn about overtraining.
- [ ] **Rest Day Recommendations** -- Based on cumulative fatigue and recovery trends, suggest rest days. "You've trained 5 days in a row with declining recovery scores. Consider a rest day."

#### Medium
- [ ] **Recovery vs. Performance Correlation** -- Chart showing how recovery score correlates with workout performance. Proves the value of good recovery.
- [ ] **Heart Rate Variability (HRV)** -- Integration with Apple Health / Google Fit for HRV data. Gold standard for recovery assessment.
- [ ] **Sleep Quality Tips** -- Based on sleep data, provide personalized tips. "Your sleep quality drops on days you train after 8pm."
- [ ] **Recovery Protocols** -- After detecting high soreness in specific areas, suggest recovery protocols: stretching, foam rolling, light cardio.

#### Creative / Premium
- [ ] **Wearable Integration** -- Apple Watch, Garmin, Whoop, Oura Ring. Pull sleep, HRV, resting heart rate automatically.
- [ ] **Readiness Score Dashboard** -- Morning readiness score combining sleep, HRV, and previous day's training load. Like Whoop's recovery score.
- [ ] **Recovery AI Insights** -- "Your energy levels are consistently lower on Wednesdays. This correlates with your Tuesday leg sessions. Consider moving legs to Thursday."
- [ ] **Cold/Heat Therapy Logging** -- Track ice baths, sauna sessions, contrast therapy. Correlate with recovery scores.

---

## 6. PROGRAMS & PERIODIZATION

### Current State
- 5 built-in workout templates in `workoutDb.ts`
- Empty program skeletons in `workoutPrograms.ts` (3 programs, all with `exercises: []`)
- Template CRUD (create, favorite, delete, start from template)
- Template editor is minimal -- only asks for name when creating

### Missing / Improvements

#### Critical
- [x] **Template Exercise Builder** -- When creating a template, allow adding exercises with set/rep/rest configuration. Currently creates empty shell. File: `src/pages/Templates.tsx` `handleCreate` function.
- [x] **Populate Program Exercises** -- All 3 programs in `workoutPrograms.ts` have empty exercise arrays. Fill them with proper exercise sequences.

#### High
- [ ] **Multi-Week Program Builder** -- Create programs that span 4-12 weeks with progressive overload built in. Each week slightly increases volume/intensity.
- [ ] **Program Calendar View** -- Assign workouts to specific days of the week. "Monday: Push, Tuesday: Pull, Wednesday: Legs, Thursday: Rest, Friday: Upper, Saturday: Lower".
- [ ] **Deload Week Automation** -- After 4-6 weeks of progression, automatically suggest a deload week with reduced volume/intensity.
- [ ] **Workout Split Presets** -- Pre-built popular splits: PPL, Bro Split, Upper/Lower, Push/Pull/Legs, PHUL, PHAT, 5/3/1, nSuns. User selects and app generates the program.

#### Medium
- [ ] **Progression Scheme Selection** -- Choose between: linear progression, double progression, undulating periodization, autoregulation (RPE-based). Apply to template.
- [ ] **Program Completion Tracking** -- Track which workouts in a program the user has completed. Show progress through the program.
- [ ] **Program Switching** -- Allow switching between programs while keeping history. Archive completed programs.
- [ ] **Auto-Progression within Program** -- If user hits all reps at target weight, auto-increase weight for next session within the program.

#### Creative / Premium
- [ ] **AI Program Design** -- User describes goals ("I want to bench 100kg in 6 months"). AI generates complete periodized program with progression built in.
- [ ] **Program Marketplace** -- Community-shared programs rated by users. Download and follow popular programs.
- [ ] **Peaking Programs** -- For powerlifters: peaking blocks before competition. For bodybuilders: prep phases before shows.
- [ ] **Auto-Regulation by Recovery** -- Adjust program's prescribed intensity based on daily recovery score. Bad recovery = reduce RPE target.

---

## 7. SOCIAL & MOTIVATION

### Current State
- Workout streak tracking (`WorkoutStreak.tsx`)
- PR celebrations with confetti (`PRCelebration.tsx`)
- Achievement service exists (`achievementService.ts`) but basic
- Improvement score on dashboard

### Missing / Improvements

#### High
- [ ] **Achievement/Badge System** -- Full badge system with categories: Consistency (streaks), Strength (weight milestones), Volume (total tonnage), Dedication (total workouts), Nutrition (streak of tracking). Display in profile.
- [ ] **Workout Sharing** -- Generate beautiful shareable cards with workout summary. Share to Instagram stories, WhatsApp, Twitter. Include exercise list, volume, duration, and PRs.
- [ ] **Weekly Summary Notifications** -- Auto-generated weekly summary: workouts completed, volume, PRs hit, nutrition adherence. Push notification + in-app.

#### Medium
- [ ] **Challenge System** -- Weekly/monthly challenges: "Log 4 workouts this week", "Drink 2L water every day", "Hit a new PR". Earn badges.
- [ ] **Workout Comparison with Friends** -- If friends use the app, compare lifts and volume anonymously. Leaderboards for key exercises.
- [ ] **Motivational Quotes** -- Daily fitness-related quotes on the dashboard. Rotate from a curated Hebrew/English collection.
- [ ] **Personal Records Timeline** -- Visual timeline of all PRs achieved. Celebrate milestones.

#### Creative / Premium
- [ ] **Community Feed** -- Share workouts and progress with other users. Comment and encourage. Like Strava but for gym.
- [ ] **Trainer/Client Mode** -- Trainers create programs and assign to clients. Monitor client progress remotely.
- [ ] **Competition Mode** -- Register for app-wide challenges. "Bench Press Challenge: Who can improve the most in 8 weeks?"
- [ ] **Streak Freeze** -- Allow one rest day per week that doesn't break the streak. Makes streaks more realistic and motivating.

---

## 8. DATA & ANALYTICS

### Current State
- CSV export of workout history (`exportService.ts`)
- Weekly report generation with share/copy
- Analytics dashboard with muscle distribution
- Cloud sync (push/pull/sync-all) to Supabase
- Offline-first with IndexedDB and sync queue

### Missing / Improvements

#### High
- [ ] **Data Import** -- Can export CSV but can't import. Support importing from: CSV, other fitness apps (Strong, JEFIT, Hevy, MyFitnessPal).
- [ ] **Interactive Charts Library** -- Use a charting library (Recharts or Visx) for proper interactive charts. Current charts are custom CSS bars. Need: line charts, area charts, scatter plots.
- [ ] **Workout Comparison (A/B)** -- Select two workouts for the same routine and compare side-by-side. Show which sets improved and which regressed.
- [ ] **Volume Analysis** -- Weekly/monthly volume by muscle group chart. Track progressive overload visually.

#### Medium
- [ ] **Training Frequency Heatmap** -- Color-coded grid showing how often each muscle group is trained. Identify neglected areas.
- [ ] **Personal Records Dashboard** -- Dedicated page showing all PRs organized by exercise. Filter by time period.
- [ ] **Estimated vs Actual Performance** -- Compare what the progression algorithm suggested vs. what the user actually did. Track algorithm accuracy.
- [ ] **Workout Efficiency Score** -- Time per set ratio. Volume per minute. Track if workouts are getting more efficient.

#### Creative / Premium
- [ ] **AI Insights Dashboard** -- Auto-generated insights: "Your pull exercises are 30% weaker than push. Consider adding more back volume." "Your optimal rest time appears to be 120s based on performance dropoff."
- [ ] **Predictive Analytics** -- Based on trends, predict when user will hit goal weight or strength milestone. "At current rate, you'll bench 100kg by March."
- [ ] **Data Snapshot / Backup** -- Create downloadable backup file containing all app data. Restore from backup.
- [ ] **Health App Integration** -- Sync data to Apple Health / Google Fit / Samsung Health. Write workout data, read sleep/heart rate data.

---

## 9. NOTIFICATIONS & REMINDERS

### Current State
- `notificationService.ts` with Web Notification API support
- Settings exist in code: workout reminders, water reminders, PR alerts
- No notification configuration UI in Settings page

### Missing / Improvements

#### Critical
- [ ] **Notification Settings UI** -- All notification configs exist in `notificationService.ts` but no UI exposes them in Settings. Add notification section with toggles for: workout reminders, rest day reminders, water reminders, PR celebrations, nutrition logging reminders, recovery logging prompts.

#### High
- [ ] **Workout Reminder** -- User sets preferred workout days and times. Push notification at scheduled time. "Time for your Push workout!"
- [ ] **Rest Day Reminder** -- If user hasn't trained in 3+ days (beyond their usual pattern), gentle nudge. "You haven't trained since Tuesday. Everything okay?"
- [ ] **Nutrition Logging Reminder** -- If user hasn't logged meals by certain times, remind them. "Don't forget to log your lunch!"

#### Medium
- [ ] **PR Celebration Notification** -- When a new PR is detected, send a push notification even if the app is closed. "New PR on Bench Press: 85kg x 5!"
- [ ] **Recovery Check-in Prompt** -- Morning notification to log recovery. "How did you sleep last night?"
- [ ] **Weekly Report Notification** -- Every Sunday, generate and push weekly summary.
- [ ] **Deload Suggestion** -- After 4+ weeks of increasing volume, suggest a deload week via notification.

#### Creative / Premium
- [ ] **Smart Notification Timing** -- Learn when user typically works out and send reminders at the optimal time. Don't send at 6am if they always train at 8pm.
- [ ] **Motivational Notifications** -- Occasional motivational content: "Your bench press is up 15% this month. Keep it up!"
- [ ] **Inactivity Detection** -- If app hasn't been opened in 3+ days, send re-engagement notification with personalized content.

---

## 10. UI/UX & ACCESSIBILITY

### Current State
- Editorial design system (navy/mustard/bone)
- 5 themes + dark mode toggle
- Hebrew RTL interface
- Reduced motion support (recently added to BottomNav)
- Focus-visible ring on BottomNav
- Pull-to-refresh on Dashboard
- Virtualized list in History
- Skeleton loading states
- Safe area handling for notched devices

### Missing / Improvements

#### High
- [ ] **Gesture Navigation** -- Swipe right on workout screen to go back. Swipe up on card to expand. Swipe left/right to navigate between days in history.
- [ ] **Haptic Feedback Refinement** -- Different patterns for different actions: light tap for set complete, medium for exercise complete, heavy for workout complete, double-tap for PR.
- [ ] **Onboarding Improvements** -- Current onboarding collects data but doesn't show the user around. Add interactive tutorial pointing out key features.

#### Medium
- [ ] **Empty State Illustrations** -- Beautiful illustrations for empty states (no workouts yet, no meals logged, no measurements). More engaging than just text.
- [ ] **Micro-Interactions** -- Subtle animations: number counters ticking up, progress bars animating, cards sliding in with spring physics.
- [ ] **Keyboard Shortcuts** -- For desktop/tablet use: Enter to confirm set, Escape to cancel, Tab to navigate between inputs.
- [ ] **Accessibility Audit** -- Full WCAG 2.1 AA compliance. Screen reader testing. Color contrast verification. ARIA labels on all interactive elements.
- [ ] **RTL Consistency Check** -- Some CSS values may not properly flip for RTL. Audit all pages for proper RTL layout.

#### Creative / Premium
- [ ] **Apple Watch / Wearable Companion** -- Companion app showing rest timer, heart rate, set tracking from wrist.
- [ ] **Dynamic Island / Live Activity** -- iOS 16+ Live Activity showing rest timer on lock screen / Dynamic Island during workout.
- [ ] **Custom App Icon** -- Allow user to choose from multiple app icons (like iOS shortcuts). Different styles for different users.
- [ ] **Sound Design** -- Curated sound effects for actions: set complete (soft ding), rest timer done (gong), PR achieved (fanfare), workout complete (victory sound).
- [ ] **Widget Support** -- iOS/Android home screen widgets showing: today's workout plan, weekly progress ring, current streak, water intake.

---

## 11. PERFORMANCE & TECH

### Current State
- Vite with code splitting (manual chunks for supabase, framer, icons, react-vendor, etc.)
- PWA with offline support and service worker
- IndexedDB for all data persistence
- Offline sync queue with retry logic
- Virtual scrolling with @tanstack/react-virtual
- Route prefetching on hover/touch
- Image preconnect for Google Fonts

### Missing / Improvements

#### High
- [x] **Conflict Resolution (Merge Sync)** -- Current sync does destructive replace (`replaceXxxFromCloud` functions in `workoutDb.ts`). If user works out offline on two devices, one device's data gets wiped. Implement timestamp-based merge: keep the most recent version of each record.
- [ ] **Local Backup Before Cloud Pull** -- Before `pullAllData` overwrites local data, create a snapshot. If cloud data is stale, user can restore.
- [ ] **Bundle Size Optimization** -- Current largest chunks: supabase (195KB), react-vendor (160KB), framer (105KB). Consider: lighter alternatives for framer-motion on simple animations, tree-shake lucide icons.

#### Medium
- [ ] **Error Boundaries Per Route** -- `PageErrorBoundary` exists but add specific recovery actions per page. "Failed to load nutrition data. Retry?"
- [ ] **Rate Limiting for Sync** -- If many records need syncing, batch them to avoid overwhelming the server. Currently syncs one by one.
- [ ] **IndexedDB Migration System** -- DB version bumps require upgrade logic. Add migration framework so upgrades are safe and testable.
- [ ] **Performance Monitoring** -- Add Web Vitals tracking: LCP, FID, CLS. Monitor in production and alert on degradation.
- [ ] **Service Worker Update Strategy** -- Current is auto-update. Consider notifying user of available update and letting them choose when to refresh.

#### Creative / Premium
- [ ] **End-to-End Encryption** -- Encrypt synced data so even Supabase can't read workout data. Privacy-first approach.
- [ ] **Multi-Device Sync Indicator** -- Show which devices are connected and last sync time per device.
- [ ] **Incremental Static Generation** -- Pre-render common pages for instant load. Combine with client-side hydration.
- [ ] **Edge Caching** -- Cache API responses at CDN edge for faster data loading globally.

---

## 12. MONETIZATION & PREMIUM FEATURES

### Premium Tier Ideas (for future consideration)

#### Free Tier
- Basic workout logging
- 3 templates
- Basic nutrition tracking (40 foods)
- Weight/measurements tracking
- Local data storage only
- 1 workout program

#### Premium Tier
- [ ] **Unlimited templates and programs**
- [ ] **Advanced analytics and charts** -- Interactive Recharts-based visualizations
- [ ] **AI Coach unlimited** -- Premium AI workout suggestions, form analysis
- [ ] **Full food database (200+) + barcode scanner**
- [ ] **Progress photos with comparison**
- [ ] **Cloud sync (Supabase)**
- [ ] **Export to PDF/CSV** -- Premium export formats
- [ ] **Achievement badges and social sharing**
- [ ] **Priority support**
- [ ] **Custom themes beyond the 5 free ones**
- [ ] **Wearable integrations** -- Apple Watch, Garmin, Whoop
- [ ] **Advanced periodization tools** -- Multi-week program builder
- [ ] **Nutrition AI** -- Meal suggestions, macro optimization
- [ ] **No advertisements** (if ads are added to free tier)

#### Business Model Considerations
- [ ] **Subscription pricing**: Monthly (~15 ILS) / Annual (~120 ILS, save 33%)
- [ ] **Free trial**: 14 days premium, then downgrade
- [ ] **Lifetime option**: One-time purchase (~400 ILS)
- [ ] **Student discount**: 50% off with student verification
- [ ] **Family plan**: Up to 5 users, shared programs

---

## 13. ISRAELI MARKET SPECIFICS

Since this is a Hebrew-first app targeting the Israeli market:

- [ ] **Israeli Food Database** -- Comprehensive Israeli food items: Burekas, Sabich, Shawarma, Falafel, Hummus varieties, Israeli salad, Labneh, Zaatar, Techina, Malabi, Kanafeh, Bourekas varieties, Israeli breakfast items, Army food (loof, ptitim)
- [ ] **Hebrew Exercise Names** -- All exercises already have Hebrew names. Ensure consistency and add Hebrew search aliases.
- [ ] **Friday/Saturday Handling** -- Israeli work week is Sunday-Thursday. Weekend is Friday-Saturday. Workout reminders and weekly stats should respect this.
- [ ] **Holiday Mode** -- Jewish holidays affect gym schedules. Add holiday awareness to workout planning.
- [ ] **Kosher Food Tagging** -- Optional kosher labeling for food items. Dairy/meat/pareve categories.
- [ ] **IDF Fitness Tests** -- Pre-built programs for IDF fitness tests (the "Bar-Or" test). Very relevant for the target audience.
- [ ] **Gym Chain Integration** -- Pre-load equipment availability for popular Israeli gym chains (Holmes Place, Premium, Zer4U, Go Active).
- [ ] **Shekel Pricing** -- All premium pricing in NIS, not USD.
- [ ] **Local Payment Methods** -- Support Bit, Paybox, and Israeli credit cards for payments.

---

## 14. QUICK WINS (Easy to Implement, High Impact)

These can be done in under 2 hours each:

1. ~~**Populate `workoutPrograms.ts` exercises** -- Fill the 3 empty programs with actual exercises~~ ✅ Done
2. ~~**Add fiber to nutrition totals** -- Field exists, just needs to be summed and displayed~~ ✅ Done
3. **Notification settings UI** -- Settings already exist in code, just need toggles in UI
4. ~~**Exercise equipment tags** -- Add equipment field to all 90 built-in exercises~~ ✅ Done
5. ~~**Secondary muscles population** -- Fill the empty `secondaryMuscles` field for all exercises~~ ✅ Done
6. ~~**Sign-out button in Settings** -- Simple button that clears auth state~~ ✅ Done
7. ~~**Delete all data option** -- Clear all IndexedDB stores and localStorage~~ ✅ Done
8. **Date range selector for charts** -- Dropdown with preset ranges
9. **Meal history by date** -- Show past days' meals, not just today
10. **Water intake history chart** -- 7-day bar chart of water consumption
11. **Cumulative fatigue indicator** -- Simple calculation from recent training volume
12. **Account display in Settings** -- Show logged-in email with sign-out option

---

## 15. LONG-TERM VISION

### Phase 1 (1-2 months) -- Foundation
- Template exercise builder
- Food database expansion (200+)
- Custom food creation
- Progress photos
- Interactive charts (Recharts)
- Notification settings UI
- Achievement badge system

### Phase 2 (2-4 months) -- Intelligence
- Recovery-to-workout integration
- AI meal suggestions
- Multi-week program builder
- Workout sharing cards
- Barcode scanner
- Body fat estimation from measurements
- Sleep trends chart

### Phase 3 (4-6 months) -- Premium
- Wearable integration (Apple Health, Google Fit)
- AI program design
- Community features
- Trainer/client mode
- Periodization tools
- Voice coach mode
- Dynamic Island / Live Activity

### Phase 4 (6-12 months) -- Scale
- Monetization layer
- Apple Watch companion app
- Home screen widgets
- Social feed
- Program marketplace
- Multi-language support (English)
- Camera-based form analysis

---

*Last updated: 2024-04-23*
*Based on comprehensive audit of all source files, services, components, and pages.*
