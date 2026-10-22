import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExerciseTutorial from './ExerciseTutorial';

// Store rules for the AI answer: App Store 5.1.2(i) wants explicit permission
// before personal data goes to a third-party AI, and Google Play's generative-AI
// policy wants a way to flag an answer without leaving the app.

const askExerciseQuestion = vi.fn(async () => 'נסו 60 ק"ג ל-8 חזרות.');
const reportAiAnswer = vi.fn(async () => true);

vi.mock('../../services/ai', () => ({
  buildExerciseGrounding: () => 'אחרון: 55 ק"ג x 8',
  askExerciseQuestion: (...args: unknown[]) => askExerciseQuestion(...(args as [])),
}));
vi.mock('../../services/dataService', () => ({ getWorkoutSessions: async () => [] }));
vi.mock('../../services/ai/errorMessages', () => ({ humanizeAIError: () => 'שגיאה' }));
vi.mock('../../services/ai/aiFeedback', () => ({
  reportAiAnswer: (...args: unknown[]) => reportAiAnswer(...(args as [])),
}));

const openAskTab = () => {
  render(<ExerciseTutorial isOpen exerciseName="Bench Press" onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole('tab', { name: /שאלה/ }));
  fireEvent.change(screen.getByLabelText('מה תרצו לשאול על התרגיל?'), {
    target: { value: 'איזה משקל לנסות?' },
  });
};

describe('ExerciseTutorial AI consent and reporting', () => {
  beforeEach(() => {
    localStorage.clear();
    askExerciseQuestion.mockClear();
    reportAiAnswer.mockClear();
  });
  afterEach(() => localStorage.clear());

  it('discloses the sharing and asks for an explicit OK before the first question', async () => {
    openAskTab();
    expect(screen.getByText(/נשלחים לשירות בינה מלאכותית חיצוני/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'אישור ושליחה' }));

    await screen.findByText('נסו 60 ק"ג ל-8 חזרות.');
    expect(askExerciseQuestion).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('ai_share_consent_v1')).not.toBeNull();
    expect(screen.queryByText(/נשלחים לשירות בינה מלאכותית חיצוני/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'שלחו למאמן' })).toBeInTheDocument();
  });

  it('skips the notice once the user has agreed', () => {
    localStorage.setItem('ai_share_consent_v1', '2026-10-22T00:00:00.000Z');
    openAskTab();
    expect(screen.queryByText(/נשלחים לשירות בינה מלאכותית חיצוני/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'שלחו למאמן' })).toBeInTheDocument();
  });

  it('reports an answer with the question it replied to', async () => {
    localStorage.setItem('ai_share_consent_v1', '2026-10-22T00:00:00.000Z');
    openAskTab();
    fireEvent.click(screen.getByRole('button', { name: 'שלחו למאמן' }));
    await screen.findByText('נסו 60 ק"ג ל-8 חזרות.');

    fireEvent.click(screen.getByRole('button', { name: 'דיווח על התשובה' }));

    await waitFor(() => expect(screen.getByText('תודה, הדיווח התקבל.')).toBeInTheDocument());
    expect(reportAiAnswer).toHaveBeenCalledWith({
      surface: 'exercise_qa',
      subject: 'Bench Press',
      question: 'איזה משקל לנסות?',
      answer: 'נסו 60 ק"ג ל-8 חזרות.',
    });
  });

  it('says so when the report did not go through', async () => {
    localStorage.setItem('ai_share_consent_v1', '2026-10-22T00:00:00.000Z');
    reportAiAnswer.mockResolvedValueOnce(false);
    openAskTab();
    fireEvent.click(screen.getByRole('button', { name: 'שלחו למאמן' }));
    await screen.findByText('נסו 60 ק"ג ל-8 חזרות.');

    fireEvent.click(screen.getByRole('button', { name: 'דיווח על התשובה' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('הדיווח לא נשלח. נסו שוב.');
  });
});
