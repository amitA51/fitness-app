// ============================================================================
// COACH PLATFORM — "who can reach this user" may have changed
// ============================================================================
// getCoachLinkState (./messageService) caches its answer for ten minutes, and
// three surfaces act on it: the Realtime reflection of coach edits
// (useCloudDataReflection), the coach-scheduled day card (TodaysWorkoutCard)
// and the unread badge (useUnreadMessages). Nothing told them when the answer
// changed, so a trainee who had just accepted an invite saw no live coach edits
// for up to ten minutes — and a failed probe was never asked again at all.
//
// This module has no imports on purpose: the services that change a link
// (invites, relationships, groups) and the cache itself (messageService) all
// depend on it, so it can never close an import cycle between them.
// ============================================================================

/** Window event: the coach-link state may have changed — read it again. */
export const COACH_LINK_STATE_EVENT = 'coach:link-state-changed';

let generation = 0;

/**
 * Bumped by every link change made on this device. A cached answer, or a probe
 * already in flight, from an older generation is stale.
 */
export const coachLinksGeneration = (): number => generation;

/** Tell the listeners to read the state again. Invalidates nothing. */
export const announceCoachLinkState = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(COACH_LINK_STATE_EVENT));
};

/**
 * This device just changed who the user is linked to: an invite accepted, a
 * coach disconnected, a client's link paused / resumed / ended, a group created
 * or deleted or its members changed. Drops the cached answer and tells the
 * listeners, who then ask the server once (the probe is shared).
 */
export const notifyCoachLinksChanged = (): void => {
  generation++;
  announceCoachLinkState();
};
