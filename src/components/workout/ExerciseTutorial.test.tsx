import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ExerciseTutorial from './ExerciseTutorial';

// The detail view is where a lifter decides whether a movement suits them, so the
// classification the library filters on has to be readable here too — otherwise it
// only exists inside the filter panel.
const renderTutorial = (props: Partial<Parameters<typeof ExerciseTutorial>[0]> = {}) =>
  render(
    <ExerciseTutorial
      isOpen
      exerciseName="משיכת פולי עליון | Lat Pulldown"
      primaryMuscle="lats"
      equipment="cable"
      mechanic="compound"
      force="pull"
      level="intermediate"
      onClose={vi.fn()}
      {...props}
    />
  );

describe('ExerciseTutorial classification', () => {
  it('states the movement pattern, direction and level in Hebrew', () => {
    renderTutorial();

    expect(screen.getByText('סוג')).toBeInTheDocument();
    expect(screen.getByText('מורכב')).toBeInTheDocument();
    expect(screen.getByText('כיוון')).toBeInTheDocument();
    expect(screen.getByText('משיכה')).toBeInTheDocument();
    expect(screen.getByText('רמה')).toBeInTheDocument();
    expect(screen.getByText('בינוני')).toBeInTheDocument();
  });

  it('omits the facts entirely when the movement is unclassified', () => {
    renderTutorial({ mechanic: undefined, force: undefined, level: undefined });

    expect(screen.queryByText('סוג')).not.toBeInTheDocument();
    expect(screen.queryByText('כיוון')).not.toBeInTheDocument();
    expect(screen.queryByText('רמה')).not.toBeInTheDocument();
  });
});
