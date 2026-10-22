// ============================================================================
// AI data sharing — the user's explicit OK before the first question
// ============================================================================
// An answer is written by an outside AI service, so the user's data leaves the
// app. App Store guideline 5.1.2(i) asks for clear disclosure and explicit
// permission before personal data goes to a third-party AI. Each kind of data
// gets its own OK, because each disclosure names what is sent:
//   exercise — the question, the exercise and its recent numbers (in-workout Q&A)
//   running  — the runs: distances, times, pace, heart rate and the goal

export type AiShareScope = 'exercise' | 'running';

const CONSENT_KEYS: Readonly<Record<AiShareScope, string>> = {
  exercise: 'ai_share_consent_v1',
  running: 'ai_share_consent_running_v1',
};

export function hasAiShareConsent(scope: AiShareScope = 'exercise'): boolean {
  try {
    return localStorage.getItem(CONSENT_KEYS[scope]) !== null;
  } catch {
    return false;
  }
}

export function grantAiShareConsent(
  scope: AiShareScope = 'exercise',
  now: Date = new Date()
): void {
  try {
    localStorage.setItem(CONSENT_KEYS[scope], now.toISOString());
  } catch {
    // Private mode without storage: the panel simply asks again next time.
  }
}
