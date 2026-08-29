// ============================================================================
// GoalsEditor — the "חשב מהפרופיל (TDEE)" button's refusal path.
//
// The calculation deliberately returns zeros when a required input is missing
// (it used to invent weight 70 / height 175 / age 25 / male / moderately active
// and present the result as the user's own numbers). Withholding the number is
// right — withholding the reason was not: for a profile with no activity level
// the button did nothing at all, with no feedback of any kind.
//
// These tests pin the replacement: the tap answers with the app's canonical
// toast, naming the rows that are genuinely empty and the screen that holds
// them, and still publishes no fabricated macros. The fully-populated path must
// come out byte-identical to before.
// ============================================================================

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContainer } from '../../../../components/ui/GlobalToast';
import type { MacroNutrients } from '../../../../types';
import { GoalsEditor } from '../GoalsEditor';

/** Pre-existing goals in the editor — any of them changing means we published. */
const EXISTING_GOALS: MacroNutrients = { calories: 2000, protein: 150, carbs: 200, fat: 60 };

/** Every input the formula needs, answered. BMR 1749 x 1.55 = 2711 kcal. */
const ANSWERED_PROFILE = {
  weight: 80,
  height: 175,
  age: 30,
  gender: 'male',
  activityLevel: 'פעיל מתון',
  weightGoal: 'שמירה על משקל',
};

const setProfile = (profile: Record<string, unknown>) => {
  localStorage.setItem('user_profile', JSON.stringify(profile));
};

const renderEditor = () => {
  render(
    <>
      <ToastContainer />
      <GoalsEditor
        isOpen
        goals={EXISTING_GOALS}
        coachTarget={false}
        onSave={vi.fn(() => true)}
        onClose={vi.fn()}
      />
    </>
  );
};

const tapAutoCalc = async () => {
  await userEvent.click(screen.getByRole('button', { name: /חשב מהפרופיל/ }));
};

const calories = () => screen.getByLabelText('קלוריות יומיות') as HTMLInputElement;

beforeEach(() => {
  localStorage.clear();
});

describe('GoalsEditor auto-calc with an incomplete profile', () => {
  it('answers an empty profile by naming every missing row and where to fill it', async () => {
    renderEditor();

    await tapAutoCalc();

    const message = screen.getByText(
      'כדי לחשב יעד צריך להשלים בפרופיל: משקל, גובה, גיל, מין, רמת פעילות'
    );
    // Inside a live region, so the answer is announced and not merely present.
    expect(message.closest('[aria-live]')).not.toBeNull();
    expect(screen.getByText(/בקטע "פרטים אישיים"/)).toBeInTheDocument();
  });

  it('names ONLY the empty row when the body metrics are all answered', async () => {
    // The case the app actually shipped: a full body, no activity answer.
    setProfile({ ...ANSWERED_PROFILE, activityLevel: '' });
    renderEditor();

    await tapAutoCalc();

    expect(screen.getByText('כדי לחשב יעד צריך להשלים בפרופיל: רמת פעילות')).toBeInTheDocument();
  });

  it('names מין when sex is unanswered — it is worth ±166 kcal, not guessable', async () => {
    setProfile({ ...ANSWERED_PROFILE, gender: '' });
    renderEditor();

    await tapAutoCalc();

    expect(screen.getByText('כדי לחשב יעד צריך להשלים בפרופיל: מין')).toBeInTheDocument();
  });

  it('publishes no macros at all while inputs are missing', async () => {
    setProfile({ ...ANSWERED_PROFILE, weight: '', activityLevel: '' });
    renderEditor();

    await tapAutoCalc();

    expect(
      screen.getByText('כדי לחשב יעד צריך להשלים בפרופיל: משקל, רמת פעילות')
    ).toBeInTheDocument();
    expect(calories().value).toBe('2000');
    expect((screen.getByLabelText('חלבון') as HTMLInputElement).value).toBe('150');
  });
});

describe('GoalsEditor auto-calc with a complete profile', () => {
  it('fills the goals from the profile and says nothing', async () => {
    setProfile(ANSWERED_PROFILE);
    renderEditor();

    await tapAutoCalc();

    expect(calories().value).toBe('2711');
    expect((screen.getByLabelText('חלבון') as HTMLInputElement).value).toBe('203');
    expect((screen.getByLabelText('פחמימות') as HTMLInputElement).value).toBe('271');
    expect((screen.getByLabelText('שומן') as HTMLInputElement).value).toBe('91');
    expect(screen.queryByText(/כדי לחשב יעד/)).not.toBeInTheDocument();
  });

  it("accepts מין='אחר' as an answer rather than a gap", async () => {
    setProfile({ ...ANSWERED_PROFILE, gender: 'other' });
    renderEditor();

    await tapAutoCalc();

    expect(calories().value).toBe('2711');
    expect(screen.queryByText(/כדי לחשב יעד/)).not.toBeInTheDocument();
  });
});
