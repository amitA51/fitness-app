import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AdvancedSection } from './SectionCard';

// AdvancedSection is the ONE progressive-disclosure idiom on Progress and is
// mounted in both tabs. These tests pin the contract the tabs rely on — they do
// not prescribe a new one:
//   1. children are UNMOUNTED while collapsed (a closed section costs no render
//      work, and its content must not be reachable by screen readers either),
//   2. children mount on expand and unmount again on collapse,
//   3. the trigger clears the 44px touch-target floor,
//   4. the trigger carries an accessible Hebrew name and is wired to its panel.

describe('AdvancedSection', () => {
  it('renders no children while collapsed', () => {
    render(
      <AdvancedSection id="body-advanced">
        <p>ניתוח מפורט</p>
      </AdvancedSection>
    );

    expect(screen.queryByText('ניתוח מפורט')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'מתקדם' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('mounts children on expand and unmounts them again on collapse', async () => {
    const user = userEvent.setup();

    render(
      <AdvancedSection id="body-advanced">
        <p>ניתוח מפורט</p>
      </AdvancedSection>
    );

    const trigger = screen.getByRole('button', { name: 'מתקדם' });

    await user.click(trigger);
    expect(screen.getByText('ניתוח מפורט')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await user.click(trigger);
    expect(screen.queryByText('ניתוח מפורט')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('gives the trigger at least a 44px touch target', () => {
    render(
      <AdvancedSection id="body-advanced">
        <p>ניתוח מפורט</p>
      </AdvancedSection>
    );

    const trigger = screen.getByRole('button', { name: 'מתקדם' });
    expect(Number.parseFloat(trigger.style.minHeight)).toBeGreaterThanOrEqual(44);
  });

  it('names the trigger in Hebrew and points it at its own panel', () => {
    render(
      <AdvancedSection id="strength-advanced" label="פירוט תרגילים">
        <p>ניתוח מפורט</p>
      </AdvancedSection>
    );

    const trigger = screen.getByRole('button', { name: 'פירוט תרגילים' });
    expect(trigger).toHaveAccessibleName('פירוט תרגילים');
    expect(trigger).toHaveAttribute('aria-controls', 'strength-advanced-panel');
  });
});
