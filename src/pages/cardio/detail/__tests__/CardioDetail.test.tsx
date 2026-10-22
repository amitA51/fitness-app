import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardioActivity, CardioSplit, RunType, WorkoutSession } from '../../../../types';
import { buildCardioSession } from '../../../../utils/cardio';
import CardioDetail from '../../CardioDetail';

const state = vi.hoisted(() => ({
  sessions: [] as unknown[],
  user: { id: 'user-1' } as { id: string } | null,
}));
const reviewRun = vi.hoisted(() => vi.fn<[string, string], Promise<string>>());
const reportAiAnswer = vi.hoisted(() => vi.fn(async (_report: unknown) => true));

vi.mock('../../../../contexts/DataContext', () => ({
  useData: () => ({ sessions: state.sessions }),
}));
vi.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: state.user }),
}));
vi.mock('../../../../services/localStateMirror', () => ({ mirrorLocalKey: vi.fn() }));
vi.mock('../../../../services/ai/runningCoach', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../services/ai/runningCoach')>()),
  reviewRun: (runText: string, brief: string) => reviewRun(runText, brief),
}));
vi.mock('../../../../services/ai/aiFeedback', () => ({
  reportAiAnswer: (report: unknown) => reportAiAnswer(report),
}));

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

interface PartOpts {
  avgHr?: number;
  runType?: RunType;
  splits?: CardioSplit[];
}

const part = (
  activity: CardioActivity,
  km: number,
  sec: number,
  daysAgo = 0,
  opts: PartOpts = {}
): WorkoutSession =>
  buildCardioSession({
    activity,
    startTime: new Date(NOW - daysAgo * DAY - 60 * 60 * 1000).toISOString(),
    durationSec: sec,
    distanceKm: km,
    ...opts,
  });

const kmSplits = (secs: number[]): CardioSplit[] =>
  secs.map((seconds, i) => ({ index: i + 1, distanceKm: 1, seconds }));

const combined = (...sessions: WorkoutSession[]): WorkoutSession => {
  const [first] = sessions as [WorkoutSession];
  return { ...first, exercises: sessions.flatMap((s) => s.exercises) };
};

function show(session: WorkoutSession, others: WorkoutSession[] = []) {
  state.sessions = [...others, session];
  return render(
    <MemoryRouter>
      <CardioDetail session={session} justSaved={false} onBack={vi.fn()} />
    </MemoryRouter>
  );
}

const AI_ANSWER = 'מה היה טוב: קצב יציב.\nבפעם הבאה: התחילו לאט יותר.\nהריצה הבאה: ריצה קלה.';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  state.user = { id: 'user-1' };
  reviewRun.mockReset();
  reportAiAnswer.mockClear();
});
afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('CardioDetail — the coach card', () => {
  it('reads a run with splits: the notes, most important first, and a link to all advice', () => {
    // Faded: the last three kilometres ~10% slower than the first three.
    show(part('run', 6, 1890, 0, { splits: kmSplits([300, 300, 300, 320, 330, 340]) }));

    const card = screen.getByRole('region', { name: 'מה המאמן אומר' });
    expect(within(card).getByText('החצי השני היה איטי יותר')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /לכל ההמלצות/ })).toHaveAttribute(
      'href',
      '/cardio/coach'
    );
    expect(within(card).getByRole('button', { name: 'ניתוח מלא של המאמן' })).toBeInTheDocument();
    // The kilometres still render under the card.
    expect(screen.getByRole('heading', { name: 'קילומטרים' })).toBeInTheDocument();
  });

  it('tells a run without splits what it would take to say more', () => {
    show(part('run', 5, 1650));
    expect(screen.getByText(/כשנרשם קצב לכל קילומטר/)).toBeInTheDocument();
  });

  it('says the long-run jump once — in the card, not in a second banner', () => {
    const prior = part('run', 5, 1800, 10);
    show(part('run', 8, 2900), [prior]);

    expect(screen.getAllByText('קפיצה במרחק')).toHaveLength(1);
    expect(screen.queryByText(/מהריצה הארוכה ביותר שלך בחודש שלפניה/)).not.toBeInTheDocument();
  });

  it('shows what to do now on the latest run only', () => {
    const older = part('run', 5, 1800, 3);
    const newer = part('run', 6, 2100, 1);
    const { unmount } = show(newer, [older]);
    expect(screen.getByText('מה עכשיו')).toBeInTheDocument();
    unmount();

    state.sessions = [older, newer];
    render(
      <MemoryRouter>
        <CardioDetail session={older} justSaved={false} onBack={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.queryByText('מה עכשיו')).not.toBeInTheDocument();
  });

  it('gives a ride no running notes, and the screen keeps its numbers', () => {
    show(part('cycle', 30, 3600, 0, { avgHr: 140 }));

    expect(screen.queryByRole('region', { name: 'מה המאמן אומר' })).not.toBeInTheDocument();
    const hero = screen.getByRole('region', { name: 'סיכום' });
    expect(within(hero).getByText('30')).toBeInTheDocument();
    // Speed, not pace, for a ride: 30 km in an hour.
    expect(screen.getByText('מהירות ממוצעת')).toBeInTheDocument();
    expect(screen.getByText('30.0')).toBeInTheDocument();
    expect(screen.getByText('זמן')).toBeInTheDocument();
    expect(screen.getByText('דופק ממוצע')).toBeInTheDocument();
  });

  it('asks a guest to sign in instead of offering the AI review', () => {
    state.user = null;
    show(part('run', 5, 1650));
    expect(screen.getByText('התחברו לחשבון כדי לקבל ניתוח מלא של המאמן.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'ניתוח מלא של המאמן' })).not.toBeInTheDocument();
  });
});

describe('CardioDetail — a session of several parts', () => {
  // The warm-up walk is the LONGER part: the run must still be what the coach reads.
  const walk = part('walk', 4, 2400, 0, { avgHr: 100 });
  const run = part('run', 5, 1500, 0, { avgHr: 150, splits: kmSplits([300, 300, 300, 300, 300]) });
  const session = combined(walk, run);

  it('adds every part in the totals, and names the session after all its parts', () => {
    show(session);
    const hero = screen.getByRole('region', { name: 'סיכום' });
    // A walk and a run share no pace: the hero is the total time.
    expect(within(hero).getByText('1:05:00')).toBeInTheDocument();
    expect(within(hero).getByText('2')).toBeInTheDocument();
    expect(hero).toHaveTextContent('הליכה וריצה');
    // Heart rate weighted by time: (100·40 + 150·25) / 65 → 119.
    expect(screen.getByText('119')).toBeInTheDocument();
  });

  it('gives each part its own numbers and splits', () => {
    show(session);
    const walkCard = screen.getByRole('region', { name: 'הליכה' });
    const runCard = screen.getByRole('region', { name: /^ריצה/ });

    // The walk: 40:00 (at 10:00 per km) and no kilometres of its own.
    expect(within(walkCard).getByText('40:00')).toBeInTheDocument();
    expect(walkCard.querySelectorAll('.cardio-split-row')).toHaveLength(0);
    // The run: 25:00 and its five kilometres.
    expect(within(runCard).getByText('25:00')).toBeInTheDocument();
    expect(runCard.querySelectorAll('.cardio-split-row')).toHaveLength(5);
  });

  it('reads the coach notes from the running part, not the longer walk', () => {
    show(session);
    const card = screen.getByRole('region', { name: 'מה המאמן אומר' });
    expect(within(card).getByText('על חלק הריצה באימון.')).toBeInTheDocument();
    expect(within(card).getByText('ריצה מסודרת')).toBeInTheDocument();
  });

  it('judges the records on the run, not on the walk that came first', () => {
    const prior = part('run', 5, 1800, 10);
    const today = combined(part('walk', 1.2, 720), part('run', 6, 1980));
    show(today, [prior]);
    const banner = screen.getByText('שיא אישי').closest('.cardio-banner') as HTMLElement;
    expect(banner).toHaveTextContent('המרחק הארוך ביותר שלך');
    expect(within(banner).getByText('6')).toBeInTheDocument();
  });

  it('does not average a part without a distance into the pace', () => {
    // 30 km in an hour outside, then 30 minutes on a bike machine with no distance.
    show(combined(part('cycle', 30, 3600), part('indoor_cycle', 0, 1800)));
    const hero = screen.getByRole('region', { name: 'סיכום' });
    expect(within(hero).getByText('1:30:00')).toBeInTheDocument();
    expect(screen.queryByText('20.0')).not.toBeInTheDocument();
    expect(screen.queryByText('מהירות ממוצעת')).not.toBeInTheDocument();
  });
});

describe('CardioDetail — the AI review', () => {
  const runSession = () =>
    part('run', 6, 1890, 0, { splits: kmSplits([300, 300, 300, 320, 330, 340]) });

  it('asks first, shows a loading state, then the answer — and it can be reported', async () => {
    let resolve: (text: string) => void = () => {};
    reviewRun.mockImplementation(
      () =>
        new Promise<string>((r) => {
          resolve = r;
        })
    );
    const session = runSession();
    show(session);

    fireEvent.click(screen.getByRole('button', { name: 'ניתוח מלא של המאמן' }));
    expect(screen.getByText(/נשלחים לשירות בינה מלאכותית חיצוני/)).toBeInTheDocument();
    expect(reviewRun).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'אישור ושליחה' }));
    expect(localStorage.getItem('ai_share_consent_running_v1')).not.toBeNull();
    expect(screen.getByText('המאמן מנתח את הריצה…')).toBeInTheDocument();
    await waitFor(() => expect(reviewRun).toHaveBeenCalledTimes(1));
    const [runText, brief] = reviewRun.mock.calls[0] as [string, string];
    expect(runText).toContain('הריצה לניתוח');
    expect(runText).toContain('החצי השני היה איטי יותר');
    expect(brief).toContain('נתוני הרץ');

    resolve(AI_ANSWER);
    expect(await screen.findByText(/מה היה טוב: קצב יציב\./)).toBeInTheDocument();
    expect(screen.getByText('התשובה נכתבה בבינה מלאכותית ועלולה לטעות.')).toBeInTheDocument();
    expect(screen.queryByText('המאמן מנתח את הריצה…')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'דיווח על התשובה' }));
    expect(await screen.findByText('תודה, הדיווח התקבל.')).toBeInTheDocument();
    expect(reportAiAnswer).toHaveBeenCalledWith({
      surface: 'run_review',
      subject: session.id,
      question: runText,
      answer: AI_ANSWER,
    });
  });

  it('skips the question once agreed, and keeps the review when the run is opened again', async () => {
    localStorage.setItem('ai_share_consent_running_v1', '2026-10-22T00:00:00.000Z');
    reviewRun.mockResolvedValue(AI_ANSWER);
    const session = runSession();
    const { unmount } = show(session);

    fireEvent.click(screen.getByRole('button', { name: 'ניתוח מלא של המאמן' }));
    expect(screen.queryByText(/נשלחים לשירות בינה מלאכותית חיצוני/)).not.toBeInTheDocument();
    expect(await screen.findByText(/מה היה טוב: קצב יציב\./)).toBeInTheDocument();
    unmount();

    show(session);
    expect(screen.getByText(/מה היה טוב: קצב יציב\./)).toBeInTheDocument();
    expect(reviewRun).toHaveBeenCalledTimes(1);
  });

  it('explains a failure and tries again on request', async () => {
    localStorage.setItem('ai_share_consent_running_v1', '2026-10-22T00:00:00.000Z');
    reviewRun.mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce(AI_ANSWER);
    show(runSession());

    fireEvent.click(screen.getByRole('button', { name: 'ניתוח מלא של המאמן' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/אין חיבור לאינטרנט/);

    fireEvent.click(screen.getByRole('button', { name: 'נסו שוב' }));
    expect(await screen.findByText(/מה היה טוב: קצב יציב\./)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps an answer that arrives after the screen closed', async () => {
    localStorage.setItem('ai_share_consent_running_v1', '2026-10-22T00:00:00.000Z');
    let resolve: (text: string) => void = () => {};
    reviewRun.mockImplementation(
      () =>
        new Promise<string>((r) => {
          resolve = r;
        })
    );
    const session = runSession();
    const { unmount } = show(session);
    fireEvent.click(screen.getByRole('button', { name: 'ניתוח מלא של המאמן' }));
    await waitFor(() => expect(reviewRun).toHaveBeenCalledTimes(1));
    unmount();
    resolve(AI_ANSWER);
    // The late answer lands in the cache although nobody is showing it.
    await waitFor(() => expect(sessionStorage.length).toBe(1));

    show(session);
    expect(await screen.findByText(/מה היה טוב: קצב יציב\./)).toBeInTheDocument();
    expect(reviewRun).toHaveBeenCalledTimes(1);
  });

  it('cancelling the question sends nothing', () => {
    show(runSession());
    fireEvent.click(screen.getByRole('button', { name: 'ניתוח מלא של המאמן' }));
    fireEvent.click(screen.getByRole('button', { name: 'ביטול' }));
    expect(localStorage.getItem('ai_share_consent_running_v1')).toBeNull();
    expect(reviewRun).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'ניתוח מלא של המאמן' })).toHaveFocus();
  });
});
