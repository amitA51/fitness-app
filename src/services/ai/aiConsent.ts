// ============================================================================
// AI data sharing — the user's explicit OK before the first question
// ============================================================================
// An answer is written by an outside AI service, so the question, the exercise
// and the user's recent numbers for it leave the app. App Store guideline
// 5.1.2(i) asks for clear disclosure and explicit permission before personal
// data goes to a third-party AI; the AI panel asks once and remembers it here.

const AI_SHARE_CONSENT_KEY = 'ai_share_consent_v1';

export function hasAiShareConsent(): boolean {
  try {
    return localStorage.getItem(AI_SHARE_CONSENT_KEY) !== null;
  } catch {
    return false;
  }
}

export function grantAiShareConsent(now: Date = new Date()): void {
  try {
    localStorage.setItem(AI_SHARE_CONSENT_KEY, now.toISOString());
  } catch {
    // Private mode without storage: the panel simply asks again next time.
  }
}
