import type { PageAccent } from './contexts/PageThemeContext';

// ============================================================================
// Path-to-accent mapping (constant, no re-creation)
// ============================================================================

const PATH_ACCENT_MAP: Array<[RegExp, PageAccent]> = [
  [/^\/$/, 'dashboard'],
  [/^\/me$/, 'dashboard'],
  [/^\/workout/, 'workout'],
  [/^\/nutrition/, 'nutrition'],
  [/^\/progress/, 'progress'],
  [/^\/program/, 'workout'],
  [/^\/templates/, 'templates'],
  [/^\/detail/, 'history'],
  [/^\/settings/, 'settings'],
];

const PATH_LABEL_MAP: Array<[RegExp, string]> = [
  [/^\/$/, 'דשבורד'],
  [/^\/me$/, 'האימונים שלי'],
  [/^\/workout/, 'אימון'],
  [/^\/nutrition/, 'תזונה'],
  [/^\/progress/, 'התקדמות'],
  [/^\/program/, 'התוכנית שלי'],
  [/^\/templates/, 'תבניות'],
  [/^\/detail/, 'פרטי אימון'],
  [/^\/settings/, 'הגדרות'],
  [/^\/coach\/clients/, 'מתאמנים'],
  [/^\/coach\/programs/, 'תוכניות'],
  [/^\/coach\/messages/, 'הודעות'],
  [/^\/coach/, 'מרכז המאמן'],
  [/^\/my-coach/, 'המאמן שלי'],
  [/^\/join/, 'חיבור למאמן'],
  [/^\/accessibility/, 'הצהרת נגישות'],
  [/^\/legal\/terms/, 'תנאי שימוש'],
  [/^\/legal\/privacy/, 'מדיניות פרטיות'],
  [/^\/community/, 'קהילה'],
  [/^\/u\//, 'פרופיל ציבורי'],
  [/^\/paywall/, 'מנוי פרימיום'],
];

export function getPageAccent(path: string): PageAccent {
  for (const [regex, accent] of PATH_ACCENT_MAP) {
    if (regex.test(path)) return accent;
  }
  return 'dashboard';
}

export function getPageLabel(path: string): string {
  for (const [regex, label] of PATH_LABEL_MAP) {
    if (regex.test(path)) return label;
  }
  return 'מסך';
}
