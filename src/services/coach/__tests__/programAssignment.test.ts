import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutTemplate } from '../../../types';
import type { Assignment, CoachClient } from '../../../types/coach';

// ── Supabase mock (only used by createAssignment's insert path) ───────────────
const mocks = vi.hoisted(() => {
  const mockSingle = vi.fn();
  const mockSelectAfterInsert = vi.fn(() => ({ single: mockSingle }));
  const mockInsert = vi.fn(() => ({ select: mockSelectAfterInsert }));
  const mockFrom = vi.fn(() => ({ insert: mockInsert }));
  return { mockSingle, mockSelectAfterInsert, mockInsert, mockFrom };
});

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: { from: mocks.mockFrom },
}));

vi.mock('../../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'coach-1' })),
}));

// ── Dependency module mocks ──────────────────────────────────────────────────
vi.mock('../groupService', () => ({
  getGroupMemberIds: vi.fn(),
}));

vi.mock('../relationshipService', () => ({
  listClients: vi.fn(),
}));

vi.mock('../coachApi', () => ({
  upsertClientTemplate: vi.fn(),
}));

vi.mock('../pushService', () => ({
  sendCoachPush: vi.fn(),
}));

import { assignProgramToGroup, resolveProgramDays } from '../assignmentService';
import { upsertClientTemplate } from '../coachApi';
import { getGroupMemberIds } from '../groupService';
import { sendCoachPush } from '../pushService';
import { listClients } from '../relationshipService';

const mockGetGroupMemberIds = vi.mocked(getGroupMemberIds);
const mockListClients = vi.mocked(listClients);
const mockUpsert = vi.mocked(upsertClientTemplate);
const mockSendPush = vi.mocked(sendCoachPush);

// ── Fixtures ─────────────────────────────────────────────────────────────────
const makeTemplate = (name: string): WorkoutTemplate => ({
  id: 'origin-id',
  name,
  description: '',
  exercises: [],
  createdAt: '2026-06-07T00:00:00Z',
  updatedAt: '2026-06-07T00:00:00Z',
  lastUsed: null,
  timesUsed: 0,
  isFavorite: false,
});

const activeClient = (clientId: string): CoachClient => ({
  id: `link-${clientId}`,
  coachId: 'coach-1',
  clientId,
  status: 'active',
  consentAt: null,
  scopes: {},
  tags: [],
});

const days = [
  { name: 'יום A', template: makeTemplate('יום A') },
  { name: 'יום B', template: makeTemplate('יום B') },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockUpsert.mockResolvedValue({ error: null });
  // createAssignment insert returns a minimal assignment row.
  mocks.mockSingle.mockResolvedValue({
    data: {
      id: 'assignment-1',
      coach_id: 'coach-1',
      group_id: 'group-1',
      kind: 'program',
      title: 'תוכנית',
      payload: {},
    },
    error: null,
  });
});

describe('assignProgramToGroup', () => {
  it('writes per-member templates with ids unique across members and days', async () => {
    mockGetGroupMemberIds.mockResolvedValue(['m1', 'm2']);
    mockListClients.mockResolvedValue([activeClient('m1'), activeClient('m2')]);

    const result = await assignProgramToGroup({
      groupId: 'group-1',
      programName: 'תוכנית כוח',
      days,
    });

    expect(result.assignmentId).toBe('assignment-1');
    expect(result.memberCount).toBe(2);
    expect(result.failures).toEqual([]);

    // 2 members × 2 days = 4 template writes.
    expect(mockUpsert).toHaveBeenCalledTimes(4);

    // Every materialized template id is fresh and globally unique.
    const writtenIds = mockUpsert.mock.calls.map(([, tpl]) => tpl.id);
    expect(new Set(writtenIds).size).toBe(4);
    expect(writtenIds).not.toContain('origin-id');

    // Each member's first arg is their own user id.
    const memberArgs = mockUpsert.mock.calls.map(([memberId]) => memberId);
    expect(memberArgs.filter((id) => id === 'm1')).toHaveLength(2);
    expect(memberArgs.filter((id) => id === 'm2')).toHaveLength(2);
  });

  it('creates ONE group assignment row whose payload.memberDays maps each member to day refs', async () => {
    mockGetGroupMemberIds.mockResolvedValue(['m1', 'm2']);
    mockListClients.mockResolvedValue([activeClient('m1'), activeClient('m2')]);

    await assignProgramToGroup({ groupId: 'group-1', programName: 'תוכנית כוח', days });

    expect(mocks.mockInsert).toHaveBeenCalledTimes(1);
    const insertPayload = (mocks.mockInsert.mock.calls as unknown as unknown[][])[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(insertPayload.group_id).toBe('group-1');
    expect(insertPayload.kind).toBe('program');
    const payload = insertPayload.payload as Record<string, unknown>;
    expect(payload.perMember).toBe(true);
    const memberDays = payload.memberDays as Record<string, unknown[]>;
    expect(Object.keys(memberDays).sort()).toEqual(['m1', 'm2']);
    expect(memberDays.m1).toHaveLength(2);
    expect(memberDays.m2).toHaveLength(2);
  });

  it('only targets group members that are also ACTIVE coach clients', async () => {
    // m2 is in the group but not an active client → excluded.
    mockGetGroupMemberIds.mockResolvedValue(['m1', 'm2']);
    mockListClients.mockResolvedValue([activeClient('m1')]);

    const result = await assignProgramToGroup({
      groupId: 'group-1',
      programName: 'תוכנית',
      days,
    });

    expect(result.memberCount).toBe(1);
    const memberArgs = mockUpsert.mock.calls.map(([memberId]) => memberId);
    expect(memberArgs).not.toContain('m2');
  });

  it('aggregates partial failures by member id and still assigns the rest', async () => {
    mockGetGroupMemberIds.mockResolvedValue(['m1', 'm2']);
    mockListClients.mockResolvedValue([activeClient('m1'), activeClient('m2')]);
    // m2's first template write rejects; m1 succeeds fully.
    mockUpsert.mockImplementation(async (memberId: string) => {
      if (memberId === 'm2') return { error: 'rls denied' };
      return { error: null };
    });

    const result = await assignProgramToGroup({
      groupId: 'group-1',
      programName: 'תוכנית',
      days,
    });

    expect(result.failures).toEqual(['m2']);
    expect(result.memberCount).toBe(2);
    expect(result.assignmentId).toBe('assignment-1');

    // Only the successful member appears in memberDays.
    const insertPayload = (mocks.mockInsert.mock.calls as unknown as unknown[][])[0]?.[0] as Record<
      string,
      unknown
    >;
    const memberDays = (insertPayload.payload as Record<string, unknown>).memberDays as Record<
      string,
      unknown
    >;
    expect(Object.keys(memberDays)).toEqual(['m1']);
  });

  it('returns memberCount:0 and creates NO assignment row when there are no active members', async () => {
    mockGetGroupMemberIds.mockResolvedValue(['m1']);
    mockListClients.mockResolvedValue([]); // none active

    const result = await assignProgramToGroup({
      groupId: 'group-1',
      programName: 'תוכנית',
      days,
    });

    expect(result).toEqual({ assignmentId: null, memberCount: 0, failures: [] });
    expect(mockUpsert).not.toHaveBeenCalled();
    expect(mocks.mockInsert).not.toHaveBeenCalled();
    expect(mockSendPush).not.toHaveBeenCalled();
  });

  it('creates NO assignment row when every member fails to materialize', async () => {
    mockGetGroupMemberIds.mockResolvedValue(['m1', 'm2']);
    mockListClients.mockResolvedValue([activeClient('m1'), activeClient('m2')]);
    mockUpsert.mockResolvedValue({ error: 'rls denied' });

    const result = await assignProgramToGroup({
      groupId: 'group-1',
      programName: 'תוכנית',
      days,
    });

    expect(result.assignmentId).toBeNull();
    expect(result.memberCount).toBe(2);
    expect(result.failures.sort()).toEqual(['m1', 'm2']);
    expect(mocks.mockInsert).not.toHaveBeenCalled();
  });

  it('pushes a best-effort notification to each successful member', async () => {
    mockGetGroupMemberIds.mockResolvedValue(['m1', 'm2']);
    mockListClients.mockResolvedValue([activeClient('m1'), activeClient('m2')]);

    await assignProgramToGroup({ groupId: 'group-1', programName: 'תוכנית', days });

    expect(mockSendPush).toHaveBeenCalledTimes(2);
    const pushedIds = mockSendPush.mock.calls.map(([id]) => id).sort();
    expect(pushedIds).toEqual(['m1', 'm2']);
  });
});

describe('resolveProgramDays', () => {
  const baseAssignment = (payload: Record<string, unknown>): Assignment => ({
    id: 'a1',
    coachId: 'coach-1',
    clientId: null,
    groupId: 'group-1',
    kind: 'program',
    title: 'תוכנית',
    payload,
    templateId: null,
    schedule: null,
    status: 'active',
  });

  it("returns the member's own day refs from payload.memberDays", () => {
    const assignment = baseAssignment({
      memberDays: {
        m1: [{ templateId: 't-m1', name: 'יום A' }],
        m2: [{ templateId: 't-m2', name: 'יום A' }],
      },
    });

    expect(resolveProgramDays(assignment, 'm1')).toEqual([{ templateId: 't-m1', name: 'יום A' }]);
  });

  it('falls back to flat payload.days when memberDays has no entry for the user', () => {
    const assignment = baseAssignment({
      days: [{ templateId: 't-flat', name: 'יום A' }],
      memberDays: { other: [{ templateId: 't-other', name: 'יום A' }] },
    });

    expect(resolveProgramDays(assignment, 'm1')).toEqual([{ templateId: 't-flat', name: 'יום A' }]);
  });

  it('falls back to flat payload.days for a legacy direct program (no memberDays)', () => {
    const assignment = baseAssignment({
      days: [{ templateId: 't-flat', name: 'יום A' }],
    });

    expect(resolveProgramDays(assignment, 'm1')).toEqual([{ templateId: 't-flat', name: 'יום A' }]);
  });

  it('returns an empty array when neither memberDays nor days are present', () => {
    expect(resolveProgramDays(baseAssignment({}), 'm1')).toEqual([]);
  });

  it('filters out malformed day refs', () => {
    const assignment = baseAssignment({
      memberDays: {
        m1: [{ templateId: 't-ok', name: 'יום A' }, { name: 'missing id' }, null, 'bad'],
      },
    });

    expect(resolveProgramDays(assignment, 'm1')).toEqual([{ templateId: 't-ok', name: 'יום A' }]);
  });
});
