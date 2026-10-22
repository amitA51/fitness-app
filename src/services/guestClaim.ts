// ============================================================================
// "This guest is on the way to signing in" — survives the sign-in redirect.
// ============================================================================
// A guest who taps "התחברות או הרשמה" leaves guest mode (clearGuest) to reach
// the Login screen. Without a note, the sign-in that follows no longer looks
// like "guest → first account", and the transition WIPES the device instead of
// adopting it — every run, workout and goal the guest saved is gone. Google
// sign-in reloads the page, so the note lives in localStorage, not in memory.
//
// Safe by construction: transitionAuthSession adopts only when the device's
// owner marker is empty or the guest marker. A device that belonged to a real
// account still wipes on a switch, note or no note.

const GUEST_CLAIM_KEY = 'sparkos_guest_claim_pending';

export function markGuestClaimPending(): void {
  try {
    localStorage.setItem(GUEST_CLAIM_KEY, 'true');
  } catch {
    // Storage blocked: the sign-in falls back to the guest flag alone.
  }
}

export function isGuestClaimPending(): boolean {
  try {
    return localStorage.getItem(GUEST_CLAIM_KEY) === 'true';
  } catch {
    return false;
  }
}

export function clearGuestClaimPending(): void {
  try {
    localStorage.removeItem(GUEST_CLAIM_KEY);
  } catch {
    // ignore
  }
}
