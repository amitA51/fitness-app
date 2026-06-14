import { describe, expect, it } from 'vitest';
import { resolveCoachBackTarget } from '../_shared';

describe('resolveCoachBackTarget', () => {
  it('maps a message thread leaf to the messages list', () => {
    expect(resolveCoachBackTarget('/coach/messages/abc-123')).toBe('/coach/messages');
  });

  it('maps client detail and report leaves to the clients list', () => {
    expect(resolveCoachBackTarget('/coach/clients/42')).toBe('/coach/clients');
    expect(resolveCoachBackTarget('/coach/clients/42/report')).toBe('/coach/clients');
  });

  it('maps groups and invites leaves to the coach home', () => {
    expect(resolveCoachBackTarget('/coach/groups/g-7/chat')).toBe('/coach');
    expect(resolveCoachBackTarget('/coach/groups')).toBe('/coach');
    expect(resolveCoachBackTarget('/coach/invites')).toBe('/coach');
  });

  it('falls back to the coach home for any other coach leaf', () => {
    expect(resolveCoachBackTarget('/coach/programs')).toBe('/coach');
    expect(resolveCoachBackTarget('/coach/anything-else')).toBe('/coach');
  });

  it('keeps trainee (my-coach) thread leaves on the trainee side', () => {
    expect(resolveCoachBackTarget('/my-coach/messages/coach-9')).toBe('/my-coach');
    expect(resolveCoachBackTarget('/my-coach/groups/g-1/chat')).toBe('/my-coach');
  });
});
