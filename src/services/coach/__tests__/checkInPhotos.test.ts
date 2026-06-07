import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Supabase mock ─────────────────────────────────────────────────────────────
// Chainable table builder + a storage namespace. submitCheckIn ends in
// .select().single(); updateCheckInPhotos ends in .update().eq(); uploads and
// signed-URLs go through storage.from(bucket).{upload,createSignedUrls}.
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

const mockStorageUpload = vi.fn();
const mockCreateSignedUrls = vi.fn();
// One storage namespace reused for every storage.from(bucket) call.
const storageNamespace = { upload: mockStorageUpload, createSignedUrls: mockCreateSignedUrls };
const mockStorageFrom = vi.fn((_bucket: string) => storageNamespace);

const chainable: Record<string, unknown> = {};
chainable.insert = mockInsert;
chainable.update = mockUpdate;
chainable.select = mockSelect;
chainable.eq = mockEq;
chainable.single = mockSingle;

// Default chain wiring (reset per-test in beforeEach).
mockInsert.mockReturnValue(chainable);
mockUpdate.mockReturnValue(chainable);
mockSelect.mockReturnValue(chainable);
mockEq.mockResolvedValue({ error: null });
mockSingle.mockResolvedValue({ data: { id: 'ci-1' }, error: null });

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: {
    from: vi.fn(() => chainable),
    storage: { from: (bucket: string) => mockStorageFrom(bucket) },
  },
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────
vi.mock('../../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: 'user-1' })),
}));

// ── imageCompress mock — pass through a tiny blob, no real canvas ────────────
vi.mock('../../../utils/imageCompress', () => ({
  compressImageToWebP: vi.fn(async (file: File) => file),
  MAX_PHOTO_BYTES: 5 * 1024 * 1024,
}));

import { isSupabaseConfigured, supabase } from '../../../lib/supabase';
import { getCurrentUser } from '../../supabaseAuth';
import {
  type CheckIn,
  type PhotoRef,
  getPhotoUrls,
  submitCheckIn,
  uploadCheckInPhotos,
} from '../checkInService';

const mockIsConfigured = vi.mocked(isSupabaseConfigured);
const mockGetCurrentUser = vi.mocked(getCurrentUser);
type FromReturn = ReturnType<NonNullable<typeof supabase>['from']>;
// supabase is non-null at runtime because the mock always provides it.
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const mockFrom = vi.mocked(supabase!.from) as ReturnType<typeof vi.fn>;

// crypto.randomUUID is used to name uploaded files; stub it deterministically.
const uuids = ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'];

// createImageBitmap is used by uploadCheckInPhotos to read dimensions.
const mockBitmap = { width: 800, height: 600, close: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mockIsConfigured.mockReturnValue(true);
  mockGetCurrentUser.mockResolvedValue({ id: 'user-1' } as Awaited<
    ReturnType<typeof getCurrentUser>
  >);

  mockInsert.mockReturnValue(chainable);
  mockUpdate.mockReturnValue(chainable);
  mockSelect.mockReturnValue(chainable);
  mockEq.mockResolvedValue({ error: null });
  mockSingle.mockResolvedValue({ data: { id: 'ci-1' }, error: null });
  mockFrom.mockReturnValue(chainable as unknown as FromReturn);

  mockStorageFrom.mockReturnValue({
    upload: mockStorageUpload,
    createSignedUrls: mockCreateSignedUrls,
  });
  mockStorageUpload.mockResolvedValue({ error: null });
  mockCreateSignedUrls.mockResolvedValue({ data: [], error: null });

  let i = 0;
  vi.stubGlobal('crypto', { randomUUID: () => uuids[i++ % uuids.length] });
  vi.stubGlobal(
    'createImageBitmap',
    vi.fn(async () => mockBitmap)
  );
});

const fakeFile = (name: string): File =>
  new File([new Uint8Array([1, 2, 3])], name, { type: 'image/jpeg' });

// ── (a) PhotoRef mapper roundtrip ────────────────────────────────────────────
describe('toCheckIn — photos mapper roundtrip', () => {
  it('maps a photos JSONB array into typed PhotoRef[] on listCheckIns', async () => {
    const stored: PhotoRef[] = [{ path: 'user-1/ci-1/a.webp', width: 800, height: 600 }];
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'ci-1',
            user_id: 'user-1',
            date: '2026-06-07',
            weight: 80,
            mood: null,
            energy: null,
            notes: null,
            photos: stored,
            created_at: '2026-06-07T08:00:00Z',
          },
        ],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(selectChain as unknown as FromReturn);

    const { listCheckIns } = await import('../checkInService');
    const result: CheckIn[] = await listCheckIns('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]?.photos).toEqual(stored);
  });

  it('drops malformed photo entries and defaults missing dimensions to 0', async () => {
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'ci-2',
            user_id: 'user-1',
            date: '2026-06-06',
            photos: [
              { path: 'user-1/ci-2/ok.webp' }, // missing dims
              { width: 10, height: 10 }, // missing path -> dropped
              null, // -> dropped
              'nope', // -> dropped
            ],
          },
        ],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(selectChain as unknown as FromReturn);

    const { listCheckIns } = await import('../checkInService');
    const result = await listCheckIns('user-1');

    expect(result[0]?.photos).toEqual([{ path: 'user-1/ci-2/ok.webp', width: 0, height: 0 }]);
  });
});

// ── (b) uploadCheckInPhotos partial-failure aggregation ──────────────────────
describe('uploadCheckInPhotos — partial failure aggregation', () => {
  it('returns refs for successes and errors for failures without aborting', async () => {
    // First upload succeeds, second fails.
    mockStorageUpload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'storage boom' } });

    const result = await uploadCheckInPhotos('ci-1', [fakeFile('a.jpg'), fakeFile('b.jpg')]);

    expect(result.refs).toHaveLength(1);
    expect(result.refs[0]).toMatchObject({
      path: 'user-1/ci-1/11111111-1111-1111-1111-111111111111.webp',
      width: 800,
      height: 600,
    });
    expect(result.errors).toEqual(['storage boom']);
    // Both files were attempted — the failure did not abort the loop.
    expect(mockStorageUpload).toHaveBeenCalledTimes(2);
  });

  it('uploads each file into the {userId}/{checkInId}/ folder as image/webp', async () => {
    mockStorageUpload.mockResolvedValue({ error: null });

    await uploadCheckInPhotos('ci-9', [fakeFile('a.jpg')]);

    expect(mockStorageFrom).toHaveBeenCalledWith('progress-photos');
    expect(mockStorageUpload).toHaveBeenCalledWith(
      'user-1/ci-9/11111111-1111-1111-1111-111111111111.webp',
      expect.anything(),
      { contentType: 'image/webp' }
    );
  });

  it('returns an unauthenticated error per file when there is no current user', async () => {
    mockGetCurrentUser.mockResolvedValueOnce(null);

    const result = await uploadCheckInPhotos('ci-1', [fakeFile('a.jpg'), fakeFile('b.jpg')]);

    expect(result.refs).toEqual([]);
    expect(result.errors).toEqual(['unauthenticated', 'unauthenticated']);
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });
});

// ── (c) submit-then-update flow ordering ─────────────────────────────────────
describe('submitCheckIn — create-first ordering', () => {
  it('inserts the row and returns its id so photos can be attached after', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'ci-42' }, error: null });

    const result = await submitCheckIn({ weight: 80 });

    expect(result.error).toBeNull();
    expect(result.id).toBe('ci-42');
    // Row is created with an empty photos array; refs are patched in a later UPDATE.
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', photos: [] })
    );
    expect(mockFrom).toHaveBeenCalledWith('check_ins');
  });

  it('returns id=null and does not throw when the insert fails', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'insert failed' } });

    const result = await submitCheckIn({ weight: 80 });

    expect(result.error).toBe('insert failed');
    expect(result.id).toBeNull();
  });
});

// ── (d) getPhotoUrls batches paths into a path->url Map ──────────────────────
describe('getPhotoUrls — batched signed URLs', () => {
  it('returns an empty map without calling storage when there are no refs', async () => {
    const result = await getPhotoUrls([]);

    expect(result.size).toBe(0);
    expect(mockCreateSignedUrls).not.toHaveBeenCalled();
  });

  it('maps each storage path to its signed URL in one batched call', async () => {
    const refs: PhotoRef[] = [
      { path: 'user-1/ci-1/a.webp', width: 800, height: 600 },
      { path: 'user-1/ci-1/b.webp', width: 800, height: 600 },
    ];
    mockCreateSignedUrls.mockResolvedValue({
      data: [
        { path: 'user-1/ci-1/a.webp', signedUrl: 'https://signed/a' },
        { path: 'user-1/ci-1/b.webp', signedUrl: 'https://signed/b' },
      ],
      error: null,
    });

    const result = await getPhotoUrls(refs);

    expect(mockCreateSignedUrls).toHaveBeenCalledWith(
      ['user-1/ci-1/a.webp', 'user-1/ci-1/b.webp'],
      3600
    );
    expect(result.get('user-1/ci-1/a.webp')).toBe('https://signed/a');
    expect(result.get('user-1/ci-1/b.webp')).toBe('https://signed/b');
  });
});
