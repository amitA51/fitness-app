import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExerciseForm } from './ExerciseForm';

const baseFormData = {
  name: '',
  muscleGroup: '',
  category: 'strength',
  equipment: '',
  tempo: '',
  tutorialText: '',
  defaultRestTime: 90,
  defaultSets: 4,
  notes: '',
};

const renderForm = () =>
  render(
    <ExerciseForm
      formData={baseFormData}
      onChange={vi.fn()}
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
    />
  );

describe('ExerciseForm — Hebrew labels + equipment picker', () => {
  it('renders an equipment field with Hebrew option labels', () => {
    renderForm();
    expect(screen.getByText('ציוד')).toBeInTheDocument();
    // Equipment options localized to Hebrew (values stay the English keys).
    const barbell = screen.getByRole('option', { name: 'מוט' }) as HTMLOptionElement;
    expect(barbell).toBeInTheDocument();
    expect(barbell.value).toBe('barbell');
    expect(screen.getByRole('option', { name: 'משקולת יד' })).toBeInTheDocument();
  });

  it('localizes the muscle-group and category options to Hebrew', () => {
    renderForm();
    const chest = screen.getByRole('option', { name: 'חזה' }) as HTMLOptionElement;
    expect(chest.value).toBe('Chest');
    const strength = screen.getByRole('option', { name: 'כוח' }) as HTMLOptionElement;
    expect(strength.value).toBe('strength');
    // No raw English catalog keys leak into the visible options.
    expect(screen.queryByRole('option', { name: 'Chest' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'strength' })).not.toBeInTheDocument();
  });
});
