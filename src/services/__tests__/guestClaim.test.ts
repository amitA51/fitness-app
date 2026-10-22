import { beforeEach, describe, expect, it } from 'vitest';
import { clearGuestClaimPending, isGuestClaimPending, markGuestClaimPending } from '../guestClaim';

// A guest who leaves guest mode to sign in must keep what they saved: the note
// outlives the sign-in redirect and is cleared once the account is in.
describe('guestClaim', () => {
  beforeEach(() => localStorage.clear());

  it('remembers a guest on the way to sign in until the sign-in lands', () => {
    expect(isGuestClaimPending()).toBe(false);
    markGuestClaimPending();
    expect(isGuestClaimPending()).toBe(true);
    clearGuestClaimPending();
    expect(isGuestClaimPending()).toBe(false);
  });
});
