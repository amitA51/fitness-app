# 03: ביקורת Apple-style ומוכנות מכירה

## תקציר מנהלים

**פסק הדין:** המוצר מציג בסיס UX מרשים לאימון פעיל, במיוחד ב-`ModalOverlay`, `Sheet`, `SlideToComplete`, מצב הטעינה ושלד העמודים, אך **אינו מוכן עדיין למכירה של מנוי פרימיום**. ה-P0 היחיד אך המכריע הוא ש-`/paywall` הוא מסך רשימת המתנה, ללא מחיר, רכישה, שחזור רכישה או השלמת entitlement. לקוח יכול ללחוץ על CTA, אך אינו יכול לקנות דבר בפועל. ראו `src/pages/billing/PaywallScreen.tsx:5-16,252-265` ו-`src/services/billing/waitlistService.ts:24-43`.

מבחינת Apple-style, הכיוון חזק אך אינו עקבי: יש sheet פיזי עם גרירה, velocity ו-spring, Material אמיתי לניווט, וכרום RTL מודע לכיוון. מנגד, מערכת הטיפוגרפיה וה-motion מפוצלת, Setting של ניגודיות גבוהה אינו ממומש ב-CSS, ה-haptics לא עובד ב-iPhone PWA, ורבים מהפקדים המכריעים אינם עומדים ביעד מגע של 44px.

המלצת השחרור: להשיק רק beta סגור ללא תשלום. לפני מכירת מנוי יש לסגור את P0, את P1 של נגישות, haptics ו-RTL safe area, ואז לבצע QA במכשיר iPhone אמיתי וב-Android אמיתי.

## מתודולוגיה והיקף

הביקורת מבוססת רק על source code פעיל. נקראו בפועל `src/styles/{tokens,global,components,typography,motion}.css`, `tailwind.config.js`, `AppRouter`, `OnboardingFlow`, `Settings`, primitives של UI, אימון, rest timer, billing, haptics, motion וטעינה. מסמכי Markdown ישנים תחת `plans/`, `docs/` ו-`improvements/` לא שימשו מקור ראיות.

בוצעו סריקות רחבות ל-`framer-motion`, `GSAP`, CSS animations/transitions, springs, easings, haptics, safe-area ו-`style={{`. נמצאו Motion ו-GSAP במשטחים רבים; `src/lib/gsap.ts:32-38` מכיל טוקני duration גלובליים, אך גם קוד מקומי רב מחוץ להם. ספירת inline styles בוצעה על קבצי production `TSX/JSX` בלבד, ללא tests.

מגבלות: זו ביקורת קוד סטטית. לא בוצעה רכישת sandbox, מדידת contrast בכל state, או בדיקת מגע וחומרה על iPhone. כל מספרי השורות הם בנקודת הביקורת הזו.

## ציון נוכחי לפי מימד

| מימד | ציון | נימוק מבוסס קוד |
|---|---:|---|
| Typography | 5.5/10 | יש hierarchy וטוקני tracking/leading, אך scale ב-px, ללא `font-optical-sizing`, ובו זמנית הרבה גדלי טקסט inline. `src/styles/tokens.css:198-240` |
| Color / contrast | 7.0/10 | Light/Dark tokens, semantic colors ו-`prefers-reduced-transparency` טובים. Setting של high contrast מוסיף class ללא rule תואם. `src/contexts/SettingsContext.tsx:185-204`, `src/styles/components.css:1331-1368` |
| Spacing | 6.0/10 | קיים grid של 4/8pt, אך 2,687 style objects מחזירים ערכים אד-hoc למאות קבצים. `src/styles/tokens.css:248-264` |
| Depth / materials | 7.5/10 | elevation בן שלוש רמות, nav glass ו-sheet material טובים. ה-mesh מופעל כקישוט רחב במקום שכבת עומק בעלת הקשר. `src/styles/tokens.css:289-314`, `src/styles/components.css:1372-1407` |
| Motion | 6.0/10 | route transition של 220ms, GSAP scoped ו-sheet physical טובים, אבל קיימים double transitions, `transition-all`, scale-from-zero וכניסות של 480 עד 540ms. `src/AppRouter.tsx:822-838`, `src/styles/motion.css:124-126,399-414` |
| Gesture | 8.0/10 | `ModalOverlay` כולל drag handle, threshold, velocity-aware dismiss ו-spring interruptible. pull-to-refresh עדיין משנה `height` על מסלול המגע. `src/components/ui/ModalOverlay.tsx:162-219,351-365`, `src/pages/Dashboard.tsx:335-357` |
| Haptics | 4.0/10 | הכיסוי בקוד רחב, כולל workout ורכיבי sheet, אך `triggerHapticEffect` יוצא מוקדם ב-iOS ולכן iPhone PWA לא מקבל haptic. `src/utils/haptics.ts:89-98` |
| States / resilience | 7.5/10 | שלדים מותאמי מסך, retry ומצבי error טובים. יש fallback מרכזי של spinner באימון, ו-flow מסחרי אינו שלם. `src/AppPageLoader.tsx:24-86`, `src/AppRouter.tsx:888-907` |

**ציון משוקלל: 6.4/10.** זה מוצר שיכול להרגיש איכותי למתאמן שמבצע אימון, אך טרם מרגיש מוצר מסחרי בשל, עקבי ונגיש בכל מצב.

## נתון חוב inline styles

הפקודה הבאה שימשה לספירה משתחזרת:

```powershell
Get-ChildItem src -Recurse -File -Include *.tsx,*.jsx |
  Where-Object { $_.Name -notmatch '\.test\.' } |
  ForEach-Object { ([regex]::Matches([IO.File]::ReadAllText($_.FullName), 'style=\{\{')).Count }
```

**סה"כ: 2,687 מופעים של `style={{` ב-240 קבצים.**

| תיקיית-על, רק קבצי production | מופעים | קבצים |
|---|---:|---:|
| `src/components` | 1,414 | 118 |
| `src/pages` | 1,250 | 117 |
| `src` root | 12 | 2 |
| `src/errors` | 10 | 2 |
| `src/contexts` | 1 | 1 |

| תיקייה פנימית בולטת | מופעים | קבצים |
|---|---:|---:|
| `src/components/workout/components` | 309 | 23 |
| `src/pages` ישירות | 237 | 12 |
| `src/components/ui` | 227 | 31 |
| `src/components/workout` ישירות | 218 | 12 |
| `src/pages/coach` | 155 | 14 |
| `src/pages/progress/tabs` | 149 | 7 |
| `src/pages/nutrition/components` | 129 | 11 |
| `src/components/dashboard` | 112 | 12 |
| `src/components/workout/overlays` | 101 | 5 |
| `src/components/workout/states` | 81 | 3 |
| `src/pages/coach/client` | 80 | 9 |
| `src/pages/settings/sections` | 73 | 13 |
| `src/pages/progress/components` | 70 | 10 |
| `src/components/community` | 62 | 4 |
| `src/pages/login/steps` | 62 | 4 |
| `src/pages/onboarding/steps` | 57 | 7 |
| `src/components/workout/reorder` | 56 | 2 |
| `src/components/workout/history` | 53 | 1 |
| `src/pages/templates/components` | 52 | 4 |
| `src/pages/workout-detail` | 43 | 4 |

מוקדי קוד: `WorkoutSkeletons.tsx` עם 59, `WorkoutHistory.tsx` עם 53, `ExerciseTutorial.tsx` עם 50, `Program.tsx` ו-`Dashboard.tsx` עם 45 כל אחד, ו-`PaywallScreen.tsx` עם 35. זה אינו רק עניין אסתטי: כל מצב Dark, focus, pressed, contrast או reduced motion דורש כיום לתקן עשרות style objects במקום recipe מרכזי.

## P0: חוסמים מכירה

| בעיה | `file:line` | למה זה פוגע | התיקון המדויק |
|---|---|---|---|
| ה-paywall הוא רשימת המתנה, לא מנוי שניתן לרכוש | `src/pages/billing/PaywallScreen.tsx:5-16,252-265`; `src/services/billing/waitlistService.ts:24-43`; `src/services/billing/entitlementService.ts:47-77` | אין מחיר, CTA לרכישה, Trial, restore, receipt validation או מעבר entitlement. גם `PremiumLock` מפנה למסך שאי אפשר להשלים בו עסקה. אי אפשר למכור למתאמנים או למאמנים במצב זה. | החליפו את `joinWaitlist('paywall')` ב-`purchase(plan)` מול provider מאושר. הגדרו states: `idle`, `purchasing`, `pending`, `success`, `error`; CTA בגובה `52px`; כפתור `שחזור רכישות` בגובה `44px`; לאחר webhook מאומת ו-idempotent כתבו entitlement ואז `await refresh()` מ-`EntitlementContext`. מחיר, מטבע ותקופת ניסיון חייבים להגיע מ-server/store product metadata, לא להיות hardcoded ב-client. |

## P1: נדרש לפני השקה מסחרית

| בעיה | `file:line` | למה זה פוגע | התיקון המדויק |
|---|---|---|---|
| Setting של `highContrast` אינו משנה CSS בפועל | `src/contexts/SettingsContext.tsx:185-204`; `src/components/workout/hooks/useWorkoutSettings.ts:408-416`; `src/styles/components.css:1350-1368` | ה-UI מציג toggle "ניגודיות גבוהה", אך הסריקה מצאה class בלבד ולא selector `html.high-contrast`. רק העדפת OS `prefers-contrast` מטופלת. זה הבטחת נגישות שלא מתקיימת. | הוסיפו ב-`tokens.css`: `html.high-contrast { --fs-bg:#000; --fs-surface:#000; --fs-surface-2:#111; --fs-ink:#fff; --fs-muted:#f2f2f2; --color-border:#fff; --color-border-strong:#fff; --fs-accent:#8EFAD8; }`. בטלו blur ב-`.glass*` תחת class זה והכריחו border של `2px`. הוסיפו test שמוודא class וטוקנים מחושבים. |
| Setting "הפחתת אנימציות" מפסיק CSS אך לא Framer Motion | `src/contexts/SettingsContext.tsx:185-198`; `src/styles/motion.css:361-370`; `src/hooks/useReducedMotion.ts:1-3`; `src/AppRouter.tsx:675-838`; `src/components/ui/ToggleSwitch.tsx:5-7,119-137` | ה-setting מוסיף `html.reduce-motion`, אך hook משותף קורא רק `useFramerReducedMotion()` של OS. לכן route transition, `m.*` ו-ToggleSwitch ממשיכים עבור משתמש שהפעיל את ההעדפה בתוך האפליקציה. | צרו `useAppReducedMotion()` שמחזיר `settings.workoutSettings.reducedAnimations || useFramerReducedMotion()`. העבירו `MotionConfig reducedMotion={reduced ? 'always' : 'user'}` לרכיב פנימי מתחת ל-`SettingsProvider`. החליפו כל import מ-`useReducedMotion` המקומי, כולל `AppRouter`, `ToggleSwitch`, `Button`, onboarding ו-GSAP callers. |
| iPhone PWA אינו מקבל haptic feedback | `src/utils/haptics.ts:89-98`; `src/components/ui/ModalOverlay.tsx:199`; `src/components/workout/components/InlineRestTimer.tsx:91-174` | דווקא הקהל Apple-style מקבל no-op, למרות wiring טוב של threshold, set completion ו-rest countdown. `navigator.vibrate` אינו פתרון iOS Safari. | הוסיפו adapter: web fallback ל-`navigator.vibrate`, native Capacitor bridge ב-iOS. מיפוי קבוע: `selection -> Impact.Light`, `tap -> Impact.Light`, `primary commit -> Impact.Medium`, `set complete -> Notification.Success`, `3/2/1 -> Impact.Heavy`, `error -> Notification.Error`. כל מסלול חייב לעבור דרך `hapticsEnabled`. |
| RTL safe area הפוך בתחילת/סוף inline | `src/components/ui/PageHeader.tsx:73-75`; `src/styles/global.css:812-817` | ב-RTL, `inline-start` הוא ימין, אבל `safe-area-inset-left` הוא פיזית שמאל. במכשיר עם safe-area א-סימטרי padding נופל בצד הלא נכון. | הגדירו `--safe-inline-start` ו-`--safe-inline-end`: ב-root left/right, וב-`html[dir='rtl']` החליפו אותם. השתמשו ב-`max(20px, var(--safe-inline-start))` ובמקבילו end. כתבו visual test ל-LTR ול-RTL עם insets מדומים. |
| controls מרכזיים קטנים מ-44px, ו-SegmentedControl מטעה בתגובה "44px targets" | `src/pages/progress/components/SegmentedControl.tsx:28-35,64-77`; `src/components/ui/Sheet.tsx:104-121` | tabs בגובה `32px` וכפתור close בגודל `36px` מחמיצים מגע תחת עייפות, זיעה או יד אחת. זה חלש במיוחד באימון. | ב-`SegmentedControl`: container `padding:4`, `borderRadius:12`, button `minHeight:44`, `borderRadius:10`. ב-`Sheet`: close `width:44; height:44`. בנו hit-area אמיתי, לא margin בלתי לחיץ. |
| keyboard של segmented tab לא ממופה ל-RTL ואין haptic בחירת tab | `src/pages/progress/components/SegmentedControl.tsx:28-35,60-77`; `src/pages/Progress.tsx:239-287` | `ArrowRight` תמיד מתקדם index, למרות שב-RTL זה תנועה חזותית בכיוון ההפוך. שינוי tab גם שקט, בניגוד ל-`ViewModeBar`. | חשבו `const delta = isRTL ? (key === 'ArrowRight' ? -1 : 1) : (key === 'ArrowRight' ? 1 : -1)`. הפעילו `triggerHapticIntensity('selection')` רק כאשר value משתנה. הוסיפו slider indicator עם spring `{ stiffness:400, damping:30, mass:1 }`. |
| scale וטיפוגרפיה אינם Dynamic Type אמיתי | `src/styles/tokens.css:198-240`; `src/styles/typography.css:36-108`; `src/pages/Program.tsx:182-220` | הטוקנים העיקריים הם `120px/88px/48px`, `html.large-text` מגדיל רק root ב-12.5%, ורבים מהמסכים משתמשים ב-px inline. טקסט גדול יכול להיחתך או לא לגדול בכלל. אין `font-optical-sizing`. | החליפו את hierarchy: `display:2rem/1.10/-0.025em`, `title:1.375rem/1.18/-0.018em`, `headline:1.125rem/1.25/-0.012em`, `body:1rem/1.5/0`, `label:.75rem/1.25/.015em`. הוסיפו `font-optical-sizing:auto`. שמרו מספרי KPI גדולים כרכיב נפרד ולא כותרת כללית. |
| חוב inline styles מערער theme, states ו-regression control | `src/pages/Program.tsx:175-220`; `src/pages/Dashboard.tsx:335-373`; `src/pages/billing/PaywallScreen.tsx:75-469` | 2,687 objects מפזרים צבע, radius, spacing ומעברים. אין דרך אמינה להבטיח parity בין light, dark, high contrast, focus ו-reduced motion. | קבעו policy: JSX inline מותר רק ל-CSS custom property דינמי, למשל `style={{ '--progress': pct }}`. העבירו recipe סטטי ל-classes/CVA או CSS modules. יעד release ראשון: לרדת מ-2,687 ל-1,300 לכל היותר; יעד production: פחות מ-800. |
| pull-to-refresh משנה `height` בכל input frame | `src/pages/Dashboard.tsx:335-357`; `src/hooks/usePullToRefresh.ts:1-155` | עדכוני React ו-layout בזמן drag פוגעים ב-1:1 direct manipulation וב-smoothness על מכשירים חלשים. | אחסנו distance ב-`MotionValue` או ref, וציירו indicator עם `transform: translateY(calc(var(--pull) * .55)) scale(...)`. השתמשו ב-rubber-band factor `0.55`; בשחרור spring `{ stiffness:400, damping:30, mass:1 }`; אל תנפישו `height`. |

## P2: שדרוג Apple-style אגרסיבי

| בעיה | `file:line` | למה זה פוגע | התיקון המדויק |
|---|---|---|---|
| אין large-title collapse אמיתי בכותרות עמוד | `src/components/ui/PageHeader.tsx:41-75` | Header הוא sticky glass עם title קבוע בגודל `28px`. זה תקין, אך אינו נותן היררכיית iOS של large title שהופך ל-compact title תוך scroll. | הוסיפו variant `large` ל-`PageHeader`: title מ-`34px` ל-`20px`, padding top מ-`20px` ל-`10px`, opacity eyebrow מ-1 ל-0 במשך scroll range של `0..72px`. השתמשו ב-`useScroll/useTransform` בלבד, ללא listener שמעדכן React בכל pixel. |
| מעבר route פועל פעמיים | `src/AppRouter.tsx:822-838`; `src/styles/global.css:954-966` | `m.div` מבצע slide/opacity ב-220ms, ובאותו זמן `main > *` מקבל `pageEnter` CSS של 200ms ו-`translateY(8px)`. התחושה אינה משטח יחיד והיא קשה לכיול. | השאירו את Framer route transition בלבד: מחקו או צמצמו את `main > * { animation: pageEnter ... }`. השאירו `initial={false}`, `x:24`, `duration:.22`, `ease:[.16,1,.3,1]`; exit opacity `0` בלבד. |
| גל של `transition-all`, scale-from-zero ומעברים ארוכים | `src/components/ui/Button.tsx:154,343-344`; `src/styles/motion.css:124-126,399-414`; `src/pages/onboarding/steps/CompleteStep.tsx:85-104` | `transition-all` עוקב גם אחרי properties לא רצויים; `scale(0)` נראה pop מלאכותי; `480/540ms` איטי לכרום יומיומי. | החליפו ל-`transition: transform 120ms, opacity 180ms, background-color 180ms, color 180ms, box-shadow 180ms`. החליפו entry של `scale:0` ב-`opacity:0, scale:.96, y:8`; השאירו bounce רק ל-PR/achievement. |
| Progress bars משנים width/layout במקום transform | `src/pages/Program.tsx:193-194`; `src/pages/progress/components/RecoveryBar.tsx:32`; `src/components/workout/reorder/ExerciseReorderItem.tsx:329-331` | width והנפשת `height:auto` עלולים לגרום layout work. ב-Program גם 500ms ארוך ל-feedback שגרתי. | עטפו fill קבוע ב-width `100%`, והנפישו `transform:scaleX(pct / 100)` עם `transform-origin:right` ב-RTL, `left` ב-LTR. השתמשו ב-`duration:.22` ו-`ease:[.16,1,.3,1]`. החליפו `height:auto` ב-Framer `layout` או מדידה מפורשת. |
| חומרים דקורטיביים רחבים מדי | `src/styles/components.css:1372-1407`; `src/pages/Settings.tsx:124-128`; `src/pages/Dashboard.tsx:482`; `src/pages/Progress.tsx:203-209` | `ambient-mesh` על מסכי product רבים הופך canvas ל-decorative, מתחרה עם glass ומקטין ריסון Apple-like. | קבעו body למסך product ל-`var(--fs-bg)`. השאירו mesh רק ב-onboarding, celebration או hero יחיד, עם `opacity:.20` עד `.35`; ב-Settings, Progress ו-Dashboard הסירו `ambient-mesh`. |
| timer איכותי, אך reduced motion מכבה גם haptics של 3/2/1 | `src/components/workout/components/InlineRestTimer.tsx:85-99,108-128,261-263` | הפחתת motion אינה בהכרח בקשה להפחית tactile feedback. בנוסף, `linear` ב-stroke-dashoffset תקין לטיימר רציף ואינו bug בפני עצמו. | הסירו `prefersReduced` מתנאי החיווי ההפטי והשאירו רק `hapticsEnabled`, pause ו-active. השאירו ring רציף linear; עצרו pulse/glow בלבד תחת reduced motion. |
| fallback של אימון הוא spinner מרכזי, לא silhouette | `src/AppRouter.tsx:888-907`; `src/AppPageLoader.tsx:24-86` | `PageLoader` כבר יודע להציג skeleton family, אך `WorkoutPlaceholder` עובר ל-ring spinner בזמן טעינת ה-workout החשוב ביותר. | צרו `WorkoutPageLoader` עם header, timer pill, set-input cards ו-rest strip skeleton. השתמשו בו ב-`Suspense fallback`, ולא ב-`animate-spin`. |
| הבסיס של iOS settings טוב, אך switch כללי אינו דומה למתג מערכת | `src/components/ui/ToggleSwitch.tsx:23-41,112-137`; `src/components/ui/SettingsToggle.tsx:38-95` | `ToggleSwitch` מגדיר track של `40x24`, border radius חד, snapshot חד-פעמי של media query ו-`whileTap:.9`. `SettingsToggle` החדש טוב יותר מבחינת target אך visual language אינו אחיד. | איחדו ל-`Switch` יחיד: hit-box `44x44`, visual track `51x31`, knob `27`, radius `999px`, travel ב-`transform`, settle spring `{ stiffness:400,damping:30,mass:1 }`, ללא scale `.9`. |
| יש raw color token לא מוגדר | `src/styles/global.css:1128` | `var(--color-danger)` אינו מוגדר ב-`tokens.css`, ולכן gradient של swipeable action עלול להפוך ל-invalid. | החליפו ל-`var(--color-error)` או הגדירו alias `--color-danger:var(--color-error)` ב-root וב-dark. הוסיפו stylelint/custom-property check. |
| root overscroll חסום גם מחוץ ל-sheet | `src/styles/global.css:20-27,970-974`; `src/components/ui/Sheet.tsx:126-145` | containment בתוך sheet נכון כדי לא לגלול רקע. containment על כל root מחליש rubber-band ו-scroll continuity של PWA. | השאירו `overscroll-behavior:contain` רק ל-modal/sheet scroll body. ברמת app השתמשו `overscroll-behavior-y:auto` ובדקו שלא נוצרת refresh לא רצויה ב-Android. |
| כפתורים כלליים ו-select אינם חלק מטקס feedback אחד | `src/components/ui/Button.tsx:343-344`; `src/components/ui/PremiumSelect.tsx:132,204`; `src/pages/onboarding/steps/GoalsStep.tsx:68-129` | חלק מהבחירות מקבלות haptic, חלק לא. pressed states ו-scale שונים, ולכן המוצר לא מרגיש coherent. | הגדירו `usePressFeedback(intent)` עבור `selection`, `primary`, `destructive`; pointer-down מיידי `scale:.98`, release spring `400/30/1`, haptic אחד בלבד אחרי commit. אל תוסיפו haptic לכל link או scroll. |

## Before | After | Why

| Before | After | Why |
|---|---|---|
| `transition-all duration-150` ב-Button ובכרטיסים | `transform 120ms, background-color 180ms, color 180ms, box-shadow 180ms` | property-specific transition צפוי, זול יותר וקל לכיבוי ב-reduced motion. |
| `scale:0` ב-check של onboarding ו-`navDotPop` | `opacity:0; scale:.96; y:8` ואז spring `400/30/1` | כניסה אינה נראית כאילו אובייקט נזרק מהאוויר. היא שומרת רציפות מרחבית. |
| `height` משתנה לאורך pull gesture | `MotionValue` עם `translateY(pull*.55)` | pointer מרגיש 1:1, אין layout לכל touch move. |
| Segmented control בגובה `32px`, background מתחלף בלבד | target `44px`, indicator משותף עם `layoutId`, spring `400/30/1`, haptic selection | זה הופך filter קטן לפקד מובנה, פיזי ונגיש. |
| CSS `pageEnter` וגם Framer route slide | owner יחיד, Framer ב-`AppRouter` | אין y-slide נוסף או timing כפול בזמן ניווט. |
| Vibration API בלבד, עם no-op ב-iOS | native iOS bridge עם web fallback | iPhone מקבל feedback שווה לאנדרואיד והטקסים באימון מרגישים אמיתיים. |

## מה כבר ברמה גבוהה

1. **Bottom sheet פיזי ואיכותי:** `ModalOverlay` מחשב momentum projection, מפעיל threshold haptic, מזהה velocity של `>850` ומחזיר spring interruptible. `dragElastic={0.08}` ו-drag שנפתח רק מה-handle הם יישום טוב של physical gesture. `src/components/ui/ModalOverlay.tsx:91-94,162-219,351-365`.
2. **Sheet canonical אמיתי:** `Sheet` מקבל focus trap, Escape, backdrop dismissal, scroll body עם containment ו-footer עם safe-area. זו תשתית נכונה לאיחוד כל ה-sheets. `src/components/ui/Sheet.tsx:44-145`.
3. **Slide to complete מצטיין:** יש `setPointerCapture`, כיוון RTL, threshold haptic, keyboard fallback, hold-to-complete, re-entrancy guard ו-GSAP scoped. זו אינטראקציה חזקה במיוחד לפעולת סט קריטית. `src/components/workout/components/SlideToComplete.tsx:102-190,267-350`.
4. **Route navigation מכבד RTL והיסטוריה:** offset הופך סימן לפי RTL ו-POP, ומשך הכניסה הוא `.22s` עם easing טוב. נשמרים scroll position, focus ו-live announcement. `src/AppRouter.tsx:126-135,690-745,822-838`.
5. **חומרי ניווט טובים:** BottomNav משתמש ב-`saturate(180%) blur(20px)`, safe area תחתון ו-haptic בבחירה; CSS מכבד `prefers-reduced-transparency`. `src/components/ui/BottomNav.tsx:273,505-520`; `src/styles/components.css:1331-1350`.
6. **מצבי טעינה טובים ברובם:** `PageLoader` מותאם לצורת route, Dashboard ו-Progress משתמשים בשלדים, ו-Progress כולל retry אמיתי. `src/AppPageLoader.tsx:24-86`; `src/pages/Progress.tsx:160-191`.
7. **Settings קרוב ל-grouped inset list:** `SettingsCard` ממנף Card canonical ו-`SettingsRow` מספק rows, separators ו-min-height של `52px`. `src/components/ui/SettingsCard.tsx:11-17`; `src/components/ui/SettingsRow.tsx:11-37`.
8. **טיימר מנוחה מכוון לאימון אמיתי:** pause, next-set target, audio countdown, haptics, הודעה למסך כבוי ו-expanded glanceable state הם כיוון טוב ל-live activity בתוך ה-PWA. `src/components/workout/components/InlineRestTimer.tsx:56-174,216-396`.
9. **תשתית entitlement קיימת:** `EntitlementProvider`, `PlanGate` ו-`PremiumLock` כבר זמינים ומפרידים entitlement מ-UI. יש להשלים checkout, לא להשליך את הבסיס. `src/App.tsx:12-21`; `src/contexts/EntitlementContext.tsx:41-103`.
10. **Reduced motion ברמת OS מטופל במספר שכבות:** `MotionConfig reducedMotion="user"`, CSS media query והשלדים הסטטיים מספקים נקודת התחלה טובה. `src/App.tsx:10-22`; `src/styles/motion.css:347-370`.

## כיוון עיצוב יעד: Apple-style אגרסיבי אך מרוסן

היעד אינו להוסיף עוד gradients או bounce. היעד הוא להפוך את המוצר לכלי אימון שקט, צפוי ומוחשי:

- canvas אחיד וכהה או בהיר, עם material רק ל-tab bar, headers, sheets ו-popovers.
- hierarchy בסגנון iOS: large title קונטקסטואלי, compact title לאחר scroll, body Hebrew קריא, ו-numeric KPI ב-`tabular-nums` מבודד.
- grouped inset lists בהגדרות, rows של 52px, switches ב-51x31 בתוך hit-box של 44px.
- פקדי אימון ברורים ליד האגודל, pressed state מיידי, release רגוע, ו-haptic רק בנקודות commit משמעותיות.
- motion שמכבד פיזיקה: spring לכל surface שיכול להיעצר, easing מתון ל-reveal, no full-page choreography, no decorative mesh כברירת מחדל.
- rest timer שנראה ופועל כמו mini live activity: מידע הבא, התראות מדויקות, target גדול, ורציפות גם כשיש scroll או pause.

## IMPLEMENTATION BACKLOG

1. **P0, checkout adapter:** צרו `src/services/billing/purchaseService.ts` עם `purchase('pro_monthly' | 'pro_yearly')`, `restorePurchases()` ו-states typed. אין לחבר ספק payment בלי החלטת בעלים על הספק והמדינות הנתמכות.
2. **P0, server entitlement:** הוסיפו webhook server-side מאומת, idempotency key וכתיבה של `entitlements` רק לאחר receipt/store event תקין. אל תסמכו על client success בלבד.
3. **P0, paywall conversion:** ב-`PaywallScreen.tsx` החליפו waitlist ב-price cards, CTA של `52px`, `שחזור רכישות` של `44px`, progress/error/success, ואז `await refresh()` לאחר רכישה.
4. **P0, billing QA:** הוסיפו tests ל-purchase success, cancel, network error, duplicate webhook, restore ו-expired entitlement. ודאו ש-`PlanGate` מתעדכן בלי reload.
5. **P1, policy אחת ל-reduced motion:** צרו `src/hooks/useAppReducedMotion.ts`, המשלב app setting עם OS preference.
6. **P1, MotionConfig פעיל:** העבירו `MotionConfig` לרכיב פנימי מתחת ל-`SettingsProvider` והגדירו `reducedMotion={reduced ? 'always' : 'user'}`.
7. **P1, החלפת snapshot:** הסירו את module-level `prefersReducedMotion` ב-`ToggleSwitch.tsx`; השתמשו ב-hook live שמאזין לשינוי preference.
8. **P1, high contrast ממשי:** הגדירו token overrides תחת `html.high-contrast`, border של `2px`, blur כבוי ויחסי contrast של לפחות 7:1 לטקסט הרגיל.
9. **P1, high contrast regression:** הוסיפו Playwright screenshots ל-light, dark, high contrast ו-large text עבור Dashboard, Workout, Settings ו-Paywall.
10. **P1, RTL safe-area tokens:** הוסיפו `--safe-inline-start/end` ב-`tokens.css`, החליפו את `PageHeader` ואת `.safe-area-inline-*`, ובדקו iPhone landscape RTL.
11. **P1, touch target sheet:** שנו close ב-`Sheet.tsx` ל-`44x44`, ללא שינוי בגודל האייקון `18px`.
12. **P1, segmented control:** שנו ל-`minHeight:44`, container padding `4`, radius `12/10`, הוסיפו RTL arrow mapping ו-selection haptic.
13. **P1, target audit משלים:** עדכנו `WorkoutHeader` actions, back ב-Paywall ו-Settings jump chips ל-hit target מינימלי `44x44` או `min-height:44px`.
14. **P1, iOS haptic adapter:** הוסיפו bridge native וחלופת web no-op בטוחה. ודאו שכל handler משתמש ב-`hapticsEnabled` ולא קורא SDK ישירות.
15. **P1, haptic taxonomy:** תעדו constants: `selection`, `light`, `medium`, `heavy`, `success`, `error`; חברו אותם ל-tab, switch, set complete, timer finish, destructive failure בלבד.
16. **P1, type tokens:** החליפו display/title/body px בטוקני rem המפורטים בטבלת P1 והוסיפו `font-optical-sizing:auto` ל-`html` ולרכיבי display תואמים.
17. **P1, large text test:** בדקו `html.large-text` על 112.5%, 125% ו-150%, כולל Hebrew, מספרים, tab labels ו-CTA. אין truncation ואין overflow אופקי.
18. **P1, unify Tailwind and CSS tokens:** מיפוי `borderRadius` ב-`tailwind.config.js` ל-`6/10/14/18/22px`, והחלפת spring curves הסותרים ב-`[.16,1,.3,1]` ל-reveal וב-`400/30/1` לאינטראקציה.
19. **P1, recipe foundation:** צרו recipes tokenized ל-`Button`, `Card`, `ListRow`, `IconButton`, `Switch`, `SegmentedControl`; style inline מותר רק ל-custom property דינמי.
20. **P1, migration hotspots:** המירו תחילה `Program.tsx` ו-`Dashboard.tsx` עם 45 inline objects כל אחד, ואז `PaywallScreen.tsx` עם 35. יעד ביניים: פחות מ-1,300 `style={{`.
21. **P2, motion cleanup:** החליפו כל `transition-all` ב-properties מפורשים, וביטלו entry של `scale:0`. חריגים מותרים רק ב-celebration מתועד.
22. **P2, route owner יחיד:** מחקו את `main > * { animation: pageEnter }` או הגבילו אותו למסכים שאינם תחת `AppRouter` animated wrapper.
23. **P2, physical pull-to-refresh:** החליפו Dashboard `height` ב-`MotionValue`, rubber-band `.55`, release spring `400/30/1` ו-threshold אחד מתועד.
24. **P2, compositor progress:** העבירו Program, Recovery ו-workout progress מ-`width` ל-`scaleX`; duration `.22s`; origin תלוי `dir`.
25. **P2, rest timer semantics:** השאירו linear רק לטבעת הזמן הרציפה, אבל אל תקשרו haptic ל-reduced motion. הוסיפו mini timer דביק כשאזור הסט הבא מחוץ לviewport.
26. **P2, Apple header:** הוסיפו `PageHeader variant="large"` עם collapse בטווח `72px`, מ-`34px` ל-`20px`, ללא React re-render לכל scroll frame.
27. **P2, material restraint:** הסירו `ambient-mesh` מ-Dashboard, Progress ו-Settings; הגבילו אותו ל-hero/onboarding עם opacity לכל היותר `.35`.
28. **P2, loading states:** החליפו workout spinner ב-`WorkoutPageLoader` skeleton, ומפו empty/error/loading לכל route מרכזי לפני visual regression pass.

## שערי שחרור מומלצים

- רכישת sandbox, cancel, restore ו-webhook entitlement עוברים ב-iOS וב-Android.
- `highContrast`, `largeText` ו-`reducedAnimations` משנים גם CSS וגם Framer/GSAP בפועל.
- כל control שמבצע פעולה ראשית או תכופה עומד ב-44x44px לפחות.
- בדיקת RTL עם safe-area משני הצדדים אינה מציגה clipping או padding בצד הפוך.
- אין `transition: all`, אין `scale: 0` בכניסות שגרתיות, ואין motion כפול ב-route navigation.
- ספירת `style={{` יורדת לפחות ל-1,300 בשלב הראשון, עם מגמה מתועדת ל-800.
- screenshots מאושרים עבור light, dark, high contrast, large text, reduced motion ו-RTL על מסכי Dashboard, active workout, Progress, Settings ו-Paywall.
