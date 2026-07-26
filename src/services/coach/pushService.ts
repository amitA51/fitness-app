// ============================================================================
// COACH PLATFORM — Web Push subscription service
// ============================================================================
// Subscribes the device to Web Push and stores the subscription so the
// coach-push-send edge function can deliver reminders/messages when the app is
// closed. VAPID public key comes from VITE_VAPID_PUBLIC_KEY (never hard-coded).

import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export const isPushSupported = (): boolean =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

const urlBase64ToUint8Array = (base64: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  // Back the array with a concrete ArrayBuffer so it satisfies BufferSource.
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

/** Subscribe this device and persist the subscription server-side. */
export const subscribeToPush = async (): Promise<{ ok: boolean; error?: string }> => {
  if (!isPushSupported()) return { ok: false, error: 'unsupported' };
  if (!VAPID_PUBLIC_KEY) return { ok: false, error: 'no_vapid_key' };
  if (!isSupabaseConfigured() || !supabase) return { ok: false, error: 'offline' };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: 'unauthenticated' };

  if (Notification.permission !== 'granted') {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return { ok: false, error: 'denied' };
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      }));

    const json = sub.toJSON() as { endpoint?: string; keys?: Record<string, string> };
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        { user_id: user.id, endpoint: json.endpoint, keys: json.keys },
        { onConflict: 'endpoint' }
      );
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    logger.app.error('subscribeToPush failed', err);
    return { ok: false, error: 'subscribe_failed' };
  }
};

/** Remove the current device's push subscription. */
export const unsubscribeFromPush = async (): Promise<void> => {
  if (!isPushSupported()) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    if (isSupabaseConfigured() && supabase) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    }
  } catch (err) {
    logger.app.warn('unsubscribeFromPush failed', err);
  }
};

/**
 * Invoke the `coach-push-send` edge function to deliver a Web Push to a target
 * user (an active client, or self). Best-effort: never throws, so it can't
 * break the action that triggered it, and no-ops until the function is deployed.
 *
 * `url` must be an INTERNAL path (starting with `/`). The function rejects
 * absolute URLs outright: the service worker opens whatever it is handed, so an
 * external target would turn a notification carrying the app's own name and icon
 * into a phishing link.
 */
export const sendCoachPush = async (
  targetUserId: string,
  title: string,
  body?: string,
  url?: string
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase || !targetUserId || !title) return;
  try {
    await supabase.functions.invoke('coach-push-send', {
      body: { targetUserId, title, body: body ?? '', url: url ?? '/' },
    });
  } catch (err) {
    logger.app.warn('sendCoachPush failed', err);
  }
};
