# Coach Platform — Manual Setup Checklist

Things only **you** can do (the rest is already live). Project facts:
- Supabase project: **fitness** — ref `qxhgmqxiomidmimpnjvs`
- Netlify site: **fitness-app-amit** — https://fitness-app-amit.netlify.app (siteId `4bd0e953-46ae-41d8-b0e0-d2147bc43fed`)
- Link the CLI once: `supabase link --project-ref qxhgmqxiomidmimpnjvs`

---

## ✅ Already done for you (live — no action needed)
- DB migrations applied: `coach_platform`, `coach_hardening`, `coach_realtime`
  (all coaching tables + RLS + helpers + seat trigger + profile auto-create/backfill + audit columns).
- Edge functions deployed (JWT-verified): `coach-invite-accept`, `coach-push-send`.
- Realtime enabled on: assignments, messages, reminders, workout_templates, nutrition_logs.
- Netlify env var **`VITE_SUPABASE_ANON_KEY`** added (it was missing in production).
- Repo migration files + `docs/COACH_PLATFORM.md` + `plans/COACH-PLATFORM-NEXT-STEPS.md` written.

---

## ⛔ You must do manually

### 1. Commit + deploy the frontend  — REQUIRED to make coaching live
The coaching code is **not committed and not deployed**. The live site still runs the old build,
and the anon key I added only takes effect on the **next** build.
> Heads up: after this deploy, production switches from "local-only" to full **cloud + auth**
> (the old live build had no anon key). Expect login to start working for real users.
```
git add -A
git commit -m "Add coach platform (coaching layer)"
git push           # if Netlify auto-builds from git
# — or — deploy the local build directly:
npm run build && npx netlify deploy --prod --dir=dist
```

### 2. Supabase Auth URL configuration — REQUIRED for login / Google / invite links in prod
Dashboard → **Authentication → URL Configuration**:
- **Site URL:** `https://fitness-app-amit.netlify.app`
- **Redirect URLs (add):** `https://fitness-app-amit.netlify.app/**` and `http://localhost:3000/**`
Why: Google OAuth + password reset (`/reset-password`) + the `/join?code=` invite links use the origin.

### 3. Edge-function CORS secret — VERIFY (probably already set, since `ai-chat` works)
The functions allow only origins in `ALLOWED_ORIGIN`. Confirm it includes prod + dev:
```
supabase secrets set ALLOWED_ORIGIN="https://fitness-app-amit.netlify.app,http://localhost:3000"
```

### 4. Web Push — OPTIONAL (only for notifications when the app is CLOSED)
Reminders already work while the app is open; this adds closed-app push.
```
npx web-push generate-vapid-keys
supabase secrets set VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> VAPID_SUBJECT=mailto:you@domain.com
```
Then on Netlify add env var `VITE_VAPID_PUBLIC_KEY=<public>` (scopes: all) and redeploy.

### 5. Run the RLS security tests — RECOMMENDED
```
supabase test db        # runs supabase/tests/coach_rls_test.sql
```

### 6. Enable leaked-password protection — RECOMMENDED (from the security advisor)
Dashboard → **Authentication → Providers/Policies** → enable the HaveIBeenPwned check.

### 7. Local dev — VERIFY
Ensure `.env.local` has `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (and `VITE_VAPID_PUBLIC_KEY` if using push).

### 8. Granting coach seats (until billing/Stripe is built)
Coaches get `seat_limit = 3` by default when they enable coach mode. To grant more by hand:
```sql
UPDATE public.coach_subscriptions SET seat_limit = 25, plan = 'pro' WHERE coach_id = '<coach-user-uuid>';
```

---

## 🧪 Smoke test after deploy (2 accounts)
1. Account A → enable **מצב מאמן** on `/coach` → create an invite (copy code/link).
2. Account B → open `/join?code=…` → consent → connect.
3. A: roster shows B → open B → send a recommendation/assign a nutrition target.
4. B: `/my-coach` shows the assignment **live**; message both ways.
5. B: disconnect → A immediately loses access to B's data.
