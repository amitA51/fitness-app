// ============================================================================
// PurchasePanel — the real purchase CTA on /paywall
// ============================================================================
// The paywall used to offer only a waitlist, so the product could not take money
// at all. This panel renders the actual checkout path, but ONLY when billing is
// genuinely live: `VITE_BILLING_LIVE === 'true'` AND the server catalogue
// (public.billing_prices) has at least one active row. Otherwise it renders
// nothing and the caller keeps showing the honest pre-launch waitlist.
//
// No price is ever hardcoded here. Amount, currency, interval, trial length and
// the VAT disclosure all come from the server catalogue, so the screen cannot
// advertise a price the billing system would not charge.
// ============================================================================

import { Crown, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { trackFunnel } from '../../../services/analytics/funnel';
import {
  type BillingPrice,
  checkoutErrorMessage,
  createCheckout,
  formatPrice,
  listActivePrices,
} from '../../../services/billing/checkoutService';
import { logger } from '../../../utils/logger';

type PanelState = 'loading' | 'ready' | 'unavailable' | 'redirecting';

interface Props {
  /** Called once we know whether a purchase is possible, so the host can swap CTAs. */
  onAvailabilityChange?: (available: boolean) => void;
}

const INTERVAL_LABEL: Record<BillingPrice['billingInterval'], string> = {
  month: 'חודשי',
  year: 'שנתי',
};

export function PurchasePanel({ onAvailabilityChange }: Props) {
  const [state, setState] = useState<PanelState>('loading');
  const [prices, setPrices] = useState<BillingPrice[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // The release flag alone is not enough: a flag flipped before the
      // catalogue is seeded would show a buy button that leads nowhere.
      if (import.meta.env.VITE_BILLING_LIVE !== 'true') {
        if (!cancelled) {
          setState('unavailable');
          onAvailabilityChange?.(false);
        }
        return;
      }

      const active = await listActivePrices('consumer');
      if (cancelled) return;

      if (active.length === 0) {
        setState('unavailable');
        onAvailabilityChange?.(false);
        return;
      }

      setPrices(active);
      // Default to the yearly plan when offered — it is the better value and the
      // one a returning visitor most often wants; the choice stays explicit.
      setSelected(
        (active.find((p) => p.billingInterval === 'year') ?? active[0])?.priceKey ?? null
      );
      setState('ready');
      onAvailabilityChange?.(true);
    };

    void load().catch((err) => {
      logger.db.warn('PurchasePanel could not load prices', err);
      if (cancelled) return;
      setState('unavailable');
      onAvailabilityChange?.(false);
    });

    return () => {
      cancelled = true;
    };
  }, [onAvailabilityChange]);

  const handlePurchase = useCallback(async () => {
    if (!selected) return;
    setError(null);
    setState('redirecting');

    const chosenPrice = prices.find((p) => p.priceKey === selected);
    trackFunnel('checkout_started', {
      priceKey: selected,
      interval: chosenPrice?.billingInterval ?? 'unknown',
    });

    const result = await createCheckout(selected);
    if (!result.ok) {
      setError(checkoutErrorMessage(result.error));
      setState('ready');
      return;
    }

    // Navigating to a provider-hosted page is the direct result of this click.
    window.location.assign(result.url);
  }, [selected, prices]);

  if (state === 'loading' || state === 'unavailable') return null;

  const chosen = prices.find((p) => p.priceKey === selected) ?? null;
  const busy = state === 'redirecting';

  return (
    <section className="px-5 pb-4 flex flex-col gap-3">
      <div role="radiogroup" aria-label="בחירת מסלול" className="flex flex-col gap-2">
        {prices.map((price) => {
          const active = price.priceKey === selected;
          return (
            <button
              key={price.priceKey}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={busy}
              onClick={() => setSelected(price.priceKey)}
              className="w-full flex items-center justify-between gap-3 transition-ui"
              style={{
                minHeight: 64,
                paddingInline: 'var(--space-4)',
                borderRadius: 'var(--radius-asymmetric)',
                background: active ? 'var(--fs-surface-2)' : 'var(--fs-surface)',
                border: `1px solid ${active ? 'var(--fs-accent)' : 'var(--color-separator)'}`,
                cursor: busy ? 'not-allowed' : 'pointer',
                textAlign: 'start',
              }}
            >
              <span className="flex flex-col gap-0.5">
                <span
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 15,
                    color: 'var(--fs-ink)',
                  }}
                >
                  מסלול {INTERVAL_LABEL[price.billingInterval]}
                </span>
                <span
                  dir="ltr"
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    color: 'var(--fs-muted)',
                  }}
                >
                  {formatPrice(price)}
                </span>
              </span>
              {price.trialDays > 0 && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'var(--fs-accent)',
                    flexShrink: 0,
                  }}
                >
                  {price.trialDays} ימי ניסיון
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => void handlePurchase()}
        disabled={busy || !chosen}
        aria-disabled={busy || !chosen}
        className="w-full flex items-center justify-center gap-2 active:scale-[0.98] transition-ui"
        style={{
          height: 52,
          borderRadius: 'var(--radius-asymmetric)',
          background: busy ? 'var(--fs-surface-2)' : 'var(--fs-accent)',
          color: busy ? 'var(--fs-muted)' : 'var(--color-ink-on-accent)',
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 16,
          border: 'none',
          cursor: busy ? 'not-allowed' : 'pointer',
        }}
      >
        {busy ? (
          <>
            <Loader2 size={18} className="animate-spin" aria-hidden="true" />
            מעבירים לתשלום...
          </>
        ) : (
          <>
            <Crown size={18} aria-hidden="true" />
            שדרוג לפרו
          </>
        )}
      </button>

      {error && (
        <p
          role="alert"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--color-error)',
            margin: 0,
            textAlign: 'center',
          }}
        >
          {error}
        </p>
      )}

      {/* "אפשר לבטל בכל עת מההגדרות" is true only while billing is off: no
          purchase can happen without a payment provider and none is configured,
          so today there is nothing to cancel. There is NO cancellation screen
          anywhere in the app — the moment billing goes live this sentence
          becomes a false promise to a paying user. Ship a cancel path in
          Settings in the same change that turns VITE_BILLING_LIVE on, or cut
          this clause. */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 12,
          color: 'var(--fs-muted)',
          margin: 0,
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        החיוב מתחדש אוטומטית בתום כל תקופה. אפשר לבטל בכל עת מההגדרות, והגישה נשמרת עד סוף התקופה
        ששולמה.
      </p>
    </section>
  );
}
