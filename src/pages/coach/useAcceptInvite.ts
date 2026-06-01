// ============================================================================
// COACH PLATFORM — shared invite-accept logic
// ============================================================================
// MyCoach (manual code entry) and JoinPage (URL/localStorage code) both accept
// a coach invite. They keep their own entry UX (input vs auto-run) but share
// ONE accept path and ONE error→Hebrew mapping here, so the behaviour can never
// drift between the two surfaces.

import { useCallback, useState } from 'react';
import { type AcceptResult, acceptInvite } from '../../services/coach';

/** Maps a service accept-failure code to the user-facing Hebrew message. */
export function inviteErrorMessage(error?: AcceptResult['error']): string {
  switch (error) {
    case 'seat_limit':
      return 'למאמן אין מקום פנוי';
    case 'expired':
      return 'תוקף ההזמנה פג';
    case 'already':
      return 'כבר מחוברים למאמן הזה';
    case 'offline':
      return 'אין חיבור לאינטרנט';
    default:
      return 'קוד לא תקין';
  }
}

/**
 * Single accept entry point with shared busy state. Returns the raw
 * {@link AcceptResult} so each caller can drive its own success UX (toast +
 * reload for MyCoach, toast + navigate for JoinPage) on top of identical logic.
 */
export function useAcceptInvite(): {
  busy: boolean;
  accept: (code: string) => Promise<AcceptResult>;
} {
  const [busy, setBusy] = useState(false);

  const accept = useCallback(async (code: string): Promise<AcceptResult> => {
    setBusy(true);
    try {
      return await acceptInvite(code);
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, accept };
}
