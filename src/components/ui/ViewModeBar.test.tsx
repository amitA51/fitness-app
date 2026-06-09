// ============================================================================
// ViewModeBar — app-level coach/trainee view switch
// Verifies radiogroup semantics, the active highlight tracking isCoachView,
// the switch action (setViewMode + navigate), and the can't-switch hidden state.
// ============================================================================

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewModeBar } from './ViewModeBar';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

let mockState: {
  isCoachView: boolean;
  canSwitchView: boolean;
  setViewMode: ReturnType<typeof vi.fn>;
};
vi.mock('../../contexts/CoachContext', () => ({ useCoach: () => mockState }));

vi.mock('../../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
vi.mock('../../utils/haptics', () => ({ triggerHapticIntensity: vi.fn() }));

beforeEach(() => {
  mockNavigate.mockClear();
  mockState = { isCoachView: false, canSwitchView: true, setViewMode: vi.fn() };
});

describe('ViewModeBar', () => {
  it('renders a radiogroup with both views, trainee checked by default', () => {
    render(<ViewModeBar />);
    expect(
      screen.getByRole('radiogroup', { name: 'החלפת תצוגה בין מתאמן למאמן' })
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'תצוגת מתאמן' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'תצוגת מאמן' })).not.toBeChecked();
  });

  it('tracks the active highlight off isCoachView, not the raw stored choice', () => {
    mockState.isCoachView = true;
    render(<ViewModeBar />);
    expect(screen.getByRole('radio', { name: 'תצוגת מאמן' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'תצוגת מתאמן' })).not.toBeChecked();
  });

  it('switches view + navigates to the view home when the other segment is chosen', async () => {
    const user = userEvent.setup();
    render(<ViewModeBar />);

    await user.click(screen.getByRole('radio', { name: 'תצוגת מאמן' }));

    expect(mockState.setViewMode).toHaveBeenCalledWith('coach');
    expect(mockNavigate).toHaveBeenCalledWith('/coach');
  });

  it('does not re-trigger a switch when the already-active segment is clicked', async () => {
    const user = userEvent.setup();
    render(<ViewModeBar />);

    await user.click(screen.getByRole('radio', { name: 'תצוגת מתאמן' }));

    expect(mockState.setViewMode).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('renders nothing when the user cannot switch views', () => {
    mockState.canSwitchView = false;
    const { container } = render(<ViewModeBar />);
    expect(container).toBeEmptyDOMElement();
  });
});
