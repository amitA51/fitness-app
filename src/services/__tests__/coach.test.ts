import { describe, expect, it } from 'vitest';
import type { Reminder } from '../../types/coach';
import { inviteLink } from '../coach/inviteService';
import { toAssignment, toCoachClient, toReminder, toSubscription } from '../coach/mappers';
import { isReminderDue } from '../coach/reminderService';

const mkReminder = (schedule: Reminder['schedule']): Reminder => ({
  id: 'r1',
  coachId: 'c1',
  clientId: 'u1',
  groupId: null,
  title: 'שתה מים',
  body: null,
  schedule,
});

describe('isReminderDue', () => {
  // 2026-05-31 is a Sunday (getDay() === 0) in local time.
  const at = (h: number, m: number) => new Date(2026, 4, 31, h, m, 0);

  it('fires when the time matches and there is no day/date filter', () => {
    expect(isReminderDue(mkReminder({ time: '08:00' }), at(8, 0))).toBe(true);
  });

  it('does not fire when the minute differs', () => {
    expect(isReminderDue(mkReminder({ time: '08:00' }), at(8, 1))).toBe(false);
    expect(isReminderDue(mkReminder({ time: '08:00' }), at(9, 0))).toBe(false);
  });

  it('respects a day-of-week filter', () => {
    expect(isReminderDue(mkReminder({ time: '08:00', days: [0] }), at(8, 0))).toBe(true);
    expect(isReminderDue(mkReminder({ time: '08:00', days: [1] }), at(8, 0))).toBe(false);
  });

  it('respects a one-off date filter', () => {
    expect(isReminderDue(mkReminder({ time: '08:00', date: '2026-05-31' }), at(8, 0))).toBe(true);
    expect(isReminderDue(mkReminder({ time: '08:00', date: '2026-06-01' }), at(8, 0))).toBe(false);
  });

  it('matches the one-off date against the LOCAL date, not UTC', () => {
    // 00:30 local — in any timezone ahead of UTC (e.g. Asia/Jerusalem) the UTC
    // date is still "yesterday", so a UTC compare would never fire this slot.
    const now = new Date(2026, 5, 1, 0, 30, 0); // 2026-06-01 00:30 local
    expect(isReminderDue(mkReminder({ time: '00:30', date: '2026-06-01' }), now)).toBe(true);
  });

  it('never fires without a time', () => {
    expect(isReminderDue(mkReminder({}), at(8, 0))).toBe(false);
  });
});

describe('coach mappers', () => {
  it('maps a coach_clients row incl. nested client profile', () => {
    const cc = toCoachClient({
      id: 'l1',
      coach_id: 'c1',
      client_id: 'u1',
      status: 'active',
      consent_at: '2026-05-01T00:00:00Z',
      scopes: { read: true, write: true },
      tags: ['vip'],
      client_profile: { id: 'u1', display_name: 'דנה' },
    });
    expect(cc.clientId).toBe('u1');
    expect(cc.status).toBe('active');
    expect(cc.tags).toEqual(['vip']);
    expect(cc.clientProfile?.displayName).toBe('דנה');
  });

  it('defaults assignment payload/status', () => {
    const a = toAssignment({ id: 'a1', coach_id: 'c1', client_id: 'u1', kind: 'note' });
    expect(a.payload).toEqual({});
    expect(a.status).toBe('active');
    expect(a.groupId).toBeNull();
  });

  it('defaults subscription seat limit', () => {
    const s = toSubscription({ coach_id: 'c1', plan: 'free', status: 'active' });
    expect(s.seatLimit).toBe(1);
  });

  it('defaults reminder schedule to an object', () => {
    const r = toReminder({ id: 'r1', coach_id: 'c1', title: 'x' });
    expect(r.schedule).toEqual({});
  });
});

describe('inviteLink', () => {
  it('builds a /join link with the code', () => {
    expect(inviteLink('ABCD2345')).toContain('/join?code=ABCD2345');
  });
});
