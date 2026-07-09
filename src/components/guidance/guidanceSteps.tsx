// guidanceSteps — content for the first-use welcome sheet.
//
// Three paged steps focused on the single primary action ("start a workout"),
// then secondary surfaces. Keep copy short, imperative, and concrete so new
// users leave knowing exactly what to tap next.
// Copy register is plural-imperative ("לחצו", "בחרו") to match the app standard.

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
    body: "במסך הבית לחצו על הכפתור הגדול 'התחל אימון'. מומלץ לבחור תבנית מוכנה — כבר יש בה תרגילים. אפשר גם להתחיל אימון ריק ולבחור תרגילים תוך כדי.",
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
