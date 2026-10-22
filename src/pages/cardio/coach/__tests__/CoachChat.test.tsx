import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachChat } from '../CoachChat';

const askRunningCoach = vi.fn();
const reportAiAnswer = vi.fn(async () => true);

vi.mock('../../../../services/ai/runningCoach', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../services/ai/runningCoach')>()),
  askRunningCoach: (...args: unknown[]) => askRunningCoach(...args),
}));
let authUser: { id: string } | null = { id: 'u1' };
const clearGuest = vi.fn();
vi.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: authUser, clearGuest }),
}));
vi.mock('../../../../services/ai/aiFeedback', () => ({
  reportAiAnswer: (...args: unknown[]) => reportAiAnswer(...(args as [])),
}));

const getBrief = () => 'BRIEF';
const NOTICE = /נשלחים לשירות בינה מלאכותית חיצוני/;

const type = (value: string) =>
  fireEvent.change(screen.getByLabelText('השאלה שלכם'), { target: { value } });

describe('CoachChat', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    askRunningCoach.mockReset();
    reportAiAnswer.mockClear();
    authUser = { id: 'u1' };
    clearGuest.mockClear();
  });

  it('shows a guest the way to sign in instead of a question that would fail', () => {
    authUser = null;
    render(<CoachChat getBrief={getBrief} />);
    expect(screen.queryByLabelText('השאלה שלכם')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'התחברות או הרשמה' }));
    expect(clearGuest).toHaveBeenCalled();
    expect(localStorage.getItem('ai_share_consent_running_v1')).toBeNull();
  });
  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('asks for an explicit OK on first use, then answers with the AI footer', async () => {
    askRunningCoach.mockResolvedValueOnce('השבוע: שלוש ריצות קלות וארוכה אחת.');
    render(<CoachChat getBrief={getBrief} subject="10 ק״מ" />);

    expect(screen.getByText(NOTICE)).toBeInTheDocument();
    type('מה לעשות השבוע?');
    fireEvent.click(screen.getByRole('button', { name: 'אישור ושליחה' }));

    expect(await screen.findByText('השבוע: שלוש ריצות קלות וארוכה אחת.')).toBeInTheDocument();
    expect(askRunningCoach).toHaveBeenCalledWith('מה לעשות השבוע?', 'BRIEF', []);
    expect(localStorage.getItem('ai_share_consent_running_v1')).not.toBeNull();
    expect(screen.queryByText(NOTICE)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'שלחו למאמן' })).toBeInTheDocument();
    expect(screen.getByText('התשובה נכתבה בבינה מלאכותית ועלולה לטעות.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'דיווח על התשובה' }));
    await waitFor(() => expect(screen.getByText('תודה, הדיווח התקבל.')).toBeInTheDocument());
    expect(reportAiAnswer).toHaveBeenCalledWith({
      surface: 'running_coach',
      subject: '10 ק״מ',
      question: 'מה לעשות השבוע?',
      answer: 'השבוע: שלוש ריצות קלות וארוכה אחת.',
    });

    // The conversation survives leaving the screen.
    expect(JSON.parse(sessionStorage.getItem('running_coach_chat_v1') || '[]')).toHaveLength(2);
  });

  it('a suggested question only stages the text until the user agrees', () => {
    render(<CoachChat getBrief={getBrief} />);
    fireEvent.click(screen.getByRole('button', { name: 'איך רצים בחום?' }));
    expect(askRunningCoach).not.toHaveBeenCalled();
    expect(screen.getByLabelText('השאלה שלכם')).toHaveValue('איך רצים בחום?');
    expect(screen.getByRole('button', { name: 'אישור ושליחה' })).toHaveFocus();
  });

  it('sends a suggested question at once after consent, with the chat so far', async () => {
    localStorage.setItem('ai_share_consent_running_v1', '2026-10-22T00:00:00.000Z');
    sessionStorage.setItem(
      'running_coach_chat_v1',
      JSON.stringify([
        { role: 'user', content: 'שאלה קודמת' },
        { role: 'assistant', content: 'תשובה קודמת' },
      ])
    );
    askRunningCoach.mockResolvedValueOnce('רוצו מוקדם בבוקר.');
    render(<CoachChat getBrief={getBrief} />);

    // An earlier conversation is back, so the suggestions step aside.
    expect(screen.getByText('תשובה קודמת')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'איך רצים בחום?' })).not.toBeInTheDocument();

    type('איך רצים בחום?');
    fireEvent.submit(screen.getByLabelText('השאלה שלכם'));
    expect(await screen.findByText('רוצו מוקדם בבוקר.')).toBeInTheDocument();
    expect(askRunningCoach).toHaveBeenCalledWith('איך רצים בחום?', 'BRIEF', [
      { role: 'user', content: 'שאלה קודמת' },
      { role: 'assistant', content: 'תשובה קודמת' },
    ]);
  });

  it('shows a friendly error and sends the same question again on retry', async () => {
    localStorage.setItem('ai_share_consent_running_v1', '2026-10-22T00:00:00.000Z');
    askRunningCoach
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce('נסו 4 ריצות בשבוע.');
    render(<CoachChat getBrief={getBrief} />);

    type('כמה לרוץ?');
    fireEvent.click(screen.getByRole('button', { name: 'שלחו למאמן' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('אין חיבור לאינטרנט');
    // The question stays on screen, ready to send again.
    expect(screen.getByText('כמה לרוץ?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'נסו שוב' }));
    expect(await screen.findByText('נסו 4 ריצות בשבוע.')).toBeInTheDocument();
    expect(askRunningCoach).toHaveBeenLastCalledWith('כמה לרוץ?', 'BRIEF', []);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not send an empty question', () => {
    localStorage.setItem('ai_share_consent_running_v1', '2026-10-22T00:00:00.000Z');
    render(<CoachChat getBrief={getBrief} />);
    const send = screen.getByRole('button', { name: 'שלחו למאמן' });
    expect(send).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(send);
    expect(askRunningCoach).not.toHaveBeenCalled();
  });
});
