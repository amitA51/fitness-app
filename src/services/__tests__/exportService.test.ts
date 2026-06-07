import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutSession } from '../../types';
import { exportWorkoutHistoryCSV } from '../exportService';

const makeSession = (notes: string): WorkoutSession => ({
  id: 'session-1',
  date: '2026-06-06',
  startTime: '2026-06-06T10:00:00.000Z',
  endTime: null,
  duration: 0,
  status: 'completed',
  templateId: null,
  rating: null,
  totalVolume: 0,
  caloriesBurned: null,
  createdAt: '2026-06-06T10:00:00.000Z',
  updatedAt: '2026-06-06T10:00:00.000Z',
  notes: '',
  exercises: [
    {
      id: 'exercise-1',
      exerciseId: 'bench',
      exerciseName: 'Bench "Press"',
      targetMuscle: 'chest',
      sets: [
        {
          id: 'set-1',
          setNumber: 1,
          reps: 8,
          weight: 100,
          rpe: null,
          isWarmup: false,
          isCompleted: true,
          completedAt: '2026-06-06T10:05:00.000Z',
          notes,
        },
      ],
      notes: '',
      restSeconds: 90,
      isCompleted: true,
      order: 0,
    },
  ],
});

const readBlobText = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });

beforeEach(() => {
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:csv'),
    revokeObjectURL: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('exportService CSV export', () => {
  it('quotes cells, escapes embedded quotes, and neutralizes spreadsheet formulas', async () => {
    let capturedBlob: Blob | null = null;
    vi.mocked(URL.createObjectURL).mockImplementation((blob) => {
      capturedBlob = blob as Blob;
      return 'blob:csv';
    });

    exportWorkoutHistoryCSV([makeSession('=IMPORTDATA("https://example.test")')]);

    expect(capturedBlob).not.toBeNull();
    const csv = await readBlobText(capturedBlob!);
    expect(csv).toContain('"Bench ""Press"""');
    expect(csv).toContain(`"'=IMPORTDATA(""https://example.test"")"`);
  });
});
