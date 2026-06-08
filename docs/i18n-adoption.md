# i18n / RTL-LTR adoption plan

The app is Hebrew-first RTL. This is the path to true bidirectional (RTL Hebrew +
LTR English) support. The **foundation is in place**; full string translation is
the large follow-up (it needs a package install that the Windows dev box can't run).

## Done (foundation, dep-free)

- `src/contexts/LocaleContext.tsx` — `LocaleProvider` centralises html `dir`/`lang`
  (default `he`/RTL), persists the choice, exposes `useLocale()`. Wired at the top
  of `App.tsx`. No user-facing language switcher yet (switching is only meaningful
  once strings are externalised — otherwise Hebrew text would render LTR).

## Next (requires install — run on a machine where npm works)

```bash
npm i i18next react-i18next i18next-browser-languagedetector
npm i -D i18next-parser
```

1. Add `src/i18n/index.ts` initialising i18next with `he` (default) + `en`, bound
   to `LocaleContext` (changing locale calls `i18n.changeLanguage`).
2. Create `src/i18n/locales/he.json` + `en.json`. Extract strings with
   `i18next-parser`. Start with high-traffic screens: onboarding, Settings, nav,
   the new consent/age/cookie gates.
3. Replace hard-coded Hebrew strings with `t('key')`. Use the **hebrew-content-writer**
   skill for the `he` catalog (gender/smichut correctness) — do NOT auto-translate.
4. Add a language switcher to Settings using `useLocale().setLocale`.
5. Logical-CSS audit (run `grep -rn "ml-\|mr-\|left-\|right-\|text-left\|text-right" src/`)
   and convert physical → logical properties so LTR mirrors correctly. Reference
   the **hebrew-rtl-best-practices** skill.
6. QA both directions; verify numbers/dates render `dir="ltr"` (`.kinetic-number`).

## Scope note

Per `plans/FEATURE-EXPANSION-PLAN.md`, full i18n is ~9 dev-days — mostly string
externalisation across ~149 files, done wave-by-wave with both-direction screenshot QA.
