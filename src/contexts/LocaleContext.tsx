// ============================================================================
// LOCALE CONTEXT — i18n foundation (direction + language).
//
// Centralises the html `dir`/`lang` that today is hard-coded to RTL/Hebrew, so
// bidirectional (RTL Hebrew + LTR English) support can be turned on later. The
// default stays 'he' (RTL) and no language switcher is exposed yet — switching
// is only meaningful once strings are externalised with i18next (see
// docs/i18n-adoption.md). This provider is safe, additive infrastructure.
// ============================================================================

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type AppLocale = 'he' | 'en';
export type Direction = 'rtl' | 'ltr';

const RTL_LOCALES: ReadonlyArray<AppLocale> = ['he'];
const STORAGE_KEY = 'app_locale';

interface LocaleContextValue {
  locale: AppLocale;
  dir: Direction;
  setLocale: (locale: AppLocale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function directionFor(locale: AppLocale): Direction {
  return RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';
}

function readStoredLocale(): AppLocale {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'he' || value === 'en') return value;
  } catch {
    // storage unavailable — fall through to default
  }
  return 'he';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(readStoredLocale);
  const dir = directionFor(locale);

  // Keep the document root in sync (a11y + correct bidi rendering).
  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute('lang', locale);
    el.setAttribute('dir', dir);
  }, [locale, dir]);

  const setLocale = useCallback((next: AppLocale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // best-effort persistence
    }
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, dir, setLocale }),
    [locale, dir, setLocale]
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within a LocaleProvider');
  return ctx;
}
