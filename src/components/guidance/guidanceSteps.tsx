// guidanceSteps — content for the first-use welcome sheet.
//
// Four paged steps, each with a Lucide icon, a Hebrew title and a Hebrew body.
// Copy register is plural-imperative ("לחצו", "בחרו") to match the app standard
// (e.g. Settings' "נסו שוב"). Icons are Lucide-only per the design rules.

import { Dumbbell, TrendingUp, UtensilsCrossed } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface GuidanceStep {
  /** Lucide icon component rendered in the step's icon badge. */
  icon: LucideIcon;
  /** Hebrew step title. */
  title: string;
  /** Hebrew step body. */
  body: string;
}

export const WELCOME_SHEET_TITLE = 'איך להשתמש באפליקציה';

export const GUIDANCE_STEPS: readonly GuidanceStep[] = [
  {
    icon: Dumbbell,
    title: 'ברוכים הבאים',
    body: 'כאן תנהלו את האימונים, התזונה וההתקדמות שלכם — הכול במקום אחד. ננווט בקצרה על מה שאפשר לעשות.',
  },
  {
    icon: Dumbbell,
    title: 'להתחיל אימון',
    body: "לחצו על 'התחל אימון', בחרו תרגילים והזינו משקל וחזרות. לסיום סט החליקו את הכפתור — ואז יופעל טיימר מנוחה אוטומטי. בסיום האימון לחצו 'סיים'.",
  },
  {
    icon: UtensilsCrossed,
    title: 'תזונה ומים',
    body: 'בעמוד התזונה תתעדו ארוחות ותעקבו אחרי קלוריות ומאקרו. מתחת לכך אפשר לעדכן כמה מים שתיתם במהלך היום.',
  },
  {
    icon: TrendingUp,
    title: 'מעקב והתאמה אישית',
    body: "בעמוד 'התקדמות' תראו גרפים, נפח ושיאים אישיים, ותעדכנו את משקל הגוף. דרך 'עוד' אפשר להתחבר למאמן עם קוד הזמנה, וכל ההגדרות נמצאות שם גם כן.",
  },
] as const;
