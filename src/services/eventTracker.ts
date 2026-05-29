import { safeJsonParse } from '../utils/safeJson';

const STORAGE_KEY = 'sparkos_analytics';

interface AnalyticsEvent {
  name: string;
  ts: number;
  props?: Record<string, string | number>;
}

interface AnalyticsStore {
  events: AnalyticsEvent[];
  sessionStart: number;
  pageViews: Record<string, number>;
}

const DEFAULT_STORE: AnalyticsStore = { events: [], sessionStart: Date.now(), pageViews: {} };

function getStore(): AnalyticsStore {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { ...DEFAULT_STORE, sessionStart: Date.now() };
  return safeJsonParse<AnalyticsStore>(raw) ?? { ...DEFAULT_STORE, sessionStart: Date.now() };
}

function save(store: AnalyticsStore): void {
  const trimmed = { ...store, events: store.events.slice(-500) };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

export function trackEvent(name: string, props?: Record<string, string | number>): void {
  const store = getStore();
  store.events.push({ name, ts: Date.now(), props });
  save(store);
}

export function trackPageView(page: string): void {
  const store = getStore();
  store.pageViews[page] = (store.pageViews[page] || 0) + 1;
  save(store);
}

export function getAnalyticsSummary(): {
  totalEvents: number;
  pageViews: Record<string, number>;
  recentEvents: AnalyticsEvent[];
} {
  const store = getStore();
  return {
    totalEvents: store.events.length,
    pageViews: store.pageViews,
    recentEvents: store.events.slice(-20),
  };
}
