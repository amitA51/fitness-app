// ============================================================================
// CHECKOUT SERVICE — the client half of the purchase path
// ============================================================================
// Deliberately thin. The client sends a `priceKey` and nothing else: amount,
// currency, VAT treatment and the provider's price id all live in
// public.billing_prices and are resolved by the billing-checkout edge function.
// That keeps the browser out of the trust boundary for money.
//
// `isBillingLive()` lets the paywall stay on the honest pre-launch waitlist copy
// until the operator has (a) configured a provider and (b) activated at least
// one price. There is no invented price anywhere in the client.
// ============================================================================

import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';

export type CheckoutError =
  | 'unauthenticated'
  | 'billing_not_configured'
  | 'unknown_price'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'offline'
  | 'server';

export interface BillingPrice {
  priceKey: string;
  scope: 'consumer' | 'coach';
  grantsPlan: string;
  currency: string;
  /** Minor units (agorot / cents). Format with formatPrice(). */
  unitAmount: number;
  taxInclusive: boolean;
  billingInterval: 'month' | 'year';
  trialDays: number;
  seatLimit: number | null;
}

interface PriceRow {
  price_key: string;
  scope: string;
  grants_plan: string;
  currency: string;
  unit_amount: number;
  tax_inclusive: boolean;
  billing_interval: string;
  trial_days: number;
  seat_limit: number | null;
}

function toPrice(row: PriceRow): BillingPrice {
  return {
    priceKey: row.price_key,
    scope: row.scope === 'coach' ? 'coach' : 'consumer',
    grantsPlan: row.grants_plan,
    currency: row.currency,
    unitAmount: row.unit_amount,
    taxInclusive: row.tax_inclusive,
    billingInterval: row.billing_interval === 'year' ? 'year' : 'month',
    trialDays: row.trial_days,
    seatLimit: row.seat_limit,
  };
}

/**
 * Active prices for a scope, straight from the server catalogue. An empty array
 * means "not selling yet" — the caller must fall back to pre-launch copy rather
 * than show a price it made up.
 */
export async function listActivePrices(
  scope: 'consumer' | 'coach' = 'consumer'
): Promise<BillingPrice[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('billing_prices')
    .select(
      'price_key, scope, grants_plan, currency, unit_amount, tax_inclusive, billing_interval, trial_days, seat_limit'
    )
    .eq('scope', scope)
    .eq('is_active', true)
    .order('unit_amount', { ascending: true });

  if (error) {
    // Table missing (migration not applied) or RLS refusal → treat as not live.
    logger.db.warn('listActivePrices failed; treating billing as not live', error);
    return [];
  }
  return ((data ?? []) as PriceRow[]).map(toPrice);
}

/**
 * Whether a real purchase can be completed right now. Requires both the
 * VITE_BILLING_LIVE release flag and at least one active price, so a half-done
 * rollout cannot show a buy button that leads nowhere.
 */
export async function isBillingLive(scope: 'consumer' | 'coach' = 'consumer'): Promise<boolean> {
  if (import.meta.env.VITE_BILLING_LIVE !== 'true') return false;
  const prices = await listActivePrices(scope);
  return prices.length > 0;
}

/**
 * Start a hosted checkout. Resolves with the provider URL; the caller is
 * responsible for navigating to it (a redirect must be a direct consequence of
 * the user's click, so we do not navigate from inside the service).
 */
export async function createCheckout(
  priceKey: string,
  quantity = 1
): Promise<{ ok: true; url: string } | { ok: false; error: CheckoutError }> {
  if (!supabase) return { ok: false, error: 'billing_not_configured' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, error: 'offline' };
  }

  const { data, error } = await supabase.functions.invoke('billing-checkout', {
    body: { priceKey, quantity },
  });

  if (error) {
    logger.db.error('createCheckout transport failure', error);
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return { ok: false, error: offline ? 'offline' : 'server' };
  }

  const res = (data ?? {}) as { ok?: boolean; url?: string; error?: string };
  if (res.ok && res.url) return { ok: true, url: res.url };

  const known: CheckoutError[] = [
    'unauthenticated',
    'billing_not_configured',
    'unknown_price',
    'rate_limited',
    'provider_unavailable',
  ];
  return { ok: false, error: known.find((k) => k === res.error) ?? 'server' };
}

/** Hebrew, actionable message per failure. */
export function checkoutErrorMessage(error: CheckoutError): string {
  switch (error) {
    case 'billing_not_configured':
      return 'הרכישה עדיין לא פעילה. הצטרפו לרשימת ההמתנה ונעדכן ברגע שתיפתח.';
    case 'unknown_price':
      return 'המסלול הזה אינו זמין כרגע. רעננו את העמוד ונסו שוב.';
    case 'rate_limited':
      return 'נשלחו יותר מדי בקשות. נסו שוב בעוד כמה דקות.';
    case 'provider_unavailable':
      return 'ספק התשלומים אינו מגיב כרגע. לא בוצע חיוב. נסו שוב בעוד מספר דקות.';
    case 'offline':
      return 'אין חיבור לאינטרנט. התחברו לרשת ונסו שוב.';
    case 'unauthenticated':
      return 'יש להתחבר לחשבון לפני הרכישה.';
    default:
      return 'לא הצלחנו לפתוח את דף התשלום. לא בוצע חיוב. נסו שוב.';
  }
}

/** Format a catalogue price for display, including the VAT disclosure. */
export function formatPrice(price: BillingPrice, locale = 'he-IL'): string {
  const amount = price.unitAmount / 100;
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: price.currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
  const period = price.billingInterval === 'year' ? 'לשנה' : 'לחודש';
  const tax = price.taxInclusive ? 'כולל מע"מ' : 'לא כולל מע"מ';
  return `${formatted} ${period} · ${tax}`;
}
