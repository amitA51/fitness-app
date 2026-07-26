import type { UserScopedDataCleanupOptions } from './userScopedLocalData';
import { PENDING_AUTH_REDIRECT_KEY, PENDING_INVITE_CODE_KEY } from './userScopedLocalData';

export const INVITE_CONTINUATION_CHANGED_EVENT = 'auth:invite-continuation-changed';

const normalizeInviteCode = (value: string | null | undefined): string | null => {
  const code = value?.trim().toUpperCase() ?? '';
  return code.length > 0 && code.length <= 64 ? code : null;
};

const invitePath = (code: string): string => `/join?code=${encodeURIComponent(code)}`;

const notifyContinuationChanged = (): void => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(INVITE_CONTINUATION_CHANGED_EVENT));
  }
};

/** Save an invite code and its strictly internal destination before login. */
export const rememberInviteContinuation = (value: string): string | null => {
  const code = normalizeInviteCode(value);
  if (!code || typeof window === 'undefined') return null;

  const redirect = invitePath(code);
  try {
    window.localStorage.setItem(PENDING_INVITE_CODE_KEY, code);
    window.localStorage.setItem(PENDING_AUTH_REDIRECT_KEY, redirect);
    notifyContinuationChanged();
    return redirect;
  } catch {
    return null;
  }
};

export const getPendingInviteCode = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeInviteCode(window.localStorage.getItem(PENDING_INVITE_CODE_KEY));
  } catch {
    return null;
  }
};

const validateInviteRedirect = (value: string | null): string | null => {
  if (!value || typeof window === 'undefined') return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin || url.pathname !== '/join') return null;
    const code = normalizeInviteCode(url.searchParams.get('code'));
    return code ? invitePath(code) : null;
  } catch {
    return null;
  }
};

/** Return a continuation only when its path and code match the stored invite. */
export const getPendingInviteRedirect = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const redirect = validateInviteRedirect(window.localStorage.getItem(PENDING_AUTH_REDIRECT_KEY));
    const code = getPendingInviteCode();
    if (!redirect || !code) return null;
    return redirect === invitePath(code) ? redirect : null;
  } catch {
    return null;
  }
};

/** Preserve the invite only for the sign-in transition that will consume it. */
export const getInviteContinuationCleanupOptions = (): UserScopedDataCleanupOptions | undefined => {
  if (!getPendingInviteRedirect()) return undefined;
  return {
    preserveLocalStorageKeys: [PENDING_INVITE_CODE_KEY, PENDING_AUTH_REDIRECT_KEY],
  };
};

/** Read the explicit Login ?next= value only if it is a safe invite destination. */
export const getInviteRedirectFromSearch = (search: string): string | null => {
  const requested = new URLSearchParams(search).get('next');
  return validateInviteRedirect(requested) ?? getPendingInviteRedirect();
};

/** Use the invite URL for email-confirmation and OAuth callbacks when one exists. */
export const getInviteConfirmationRedirectUrl = (): string | undefined => {
  const redirect = getPendingInviteRedirect();
  if (!redirect || typeof window === 'undefined') return undefined;
  return new URL(redirect, window.location.origin).toString();
};

export const clearInviteContinuation = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PENDING_INVITE_CODE_KEY);
    window.localStorage.removeItem(PENDING_AUTH_REDIRECT_KEY);
  } catch {
    // Best-effort only. The next user-scoped cleanup will retry.
  }
  notifyContinuationChanged();
};
