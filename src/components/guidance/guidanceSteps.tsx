// guidanceSteps — content for the first-use welcome sheet.
//
// Three paged steps focused on the single primary action ("start a workout"),
// then secondary surfaces. Keep copy short, imperative, and concrete so new
// users leave knowing exactly what to tap next.
// Copy register is plural-imperative ("לחצו", "בחרו") to match the app standard.
//
// The sheet is shown ONLY to brand-new users, so step 1 must name the controls a
// brand-new HOME screen actually renders — the FirstRunHero pair "בחרו תבנית
// מוכנה" / "התחילו בלי תבנית". The masthead "התחל אימון" CTA is suppressed while
// the first-run hero owns the start action, so it must not be referenced here.

import { Dumbbell, ListChecks, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface GuidanceStep {
  /** Lucide icon component rendered in the step's icon badge. */
  icon: LucideIcon;
  /** Hebrew step title. */
  title: string;
  /** Hebrew step body. */
  body: string;
}

export const WELCOME_SHEET_TITLE = 'מה עושים כאן?';

export const GUIDANCE_STEPS: readonly GuidanceStep[] = [
  {
    icon: Dumbbell,
    title: 'צעד 1 — התחילו אימון',
    body: "במסך הבית לחצו על 'בחרו תבנית מוכנה' — התבנית כבר כוללת את התרגילים. רוצים להרכיב אימון בעצמכם? לחצו על 'התחילו בלי תבנית'.",
  },
  {
    icon: ListChecks,
    title: 'צעד 2 — סטים ומנוחה',
    body: 'בכל תרגיל הזינו משקל וחזרות. בסיום סט החליקו/לחצו לסימון — ואז יופעל טיימר מנוחה. כשתסיימו את כל התרגילים לחצו סיים אימון.',
  },
  {
    icon: TrendingUp,
    title: 'צעד 3 — ראו התקדמות',
    body: "אחרי האימון הראשון יופיעו במסך הבית הטבעות, הרצף והתובנות. בעמוד 'התקדמות' תראו היסטוריה ושיאים. זהו — פשוט להתחיל.",
  },
] as const;
