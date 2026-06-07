import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SliderInput } from './SliderInput';

describe('SliderInput', () => {
  it('associates the visible label with the range control and exposes the current value', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <SliderInput
        label="שעות שינה"
        value={7}
        onChange={onChange}
        min={0}
        max={12}
        step={0.5}
        unit=" ש'"
        color="var(--fs-accent)"
      />
    );

    const slider = screen.getByRole('slider', { name: 'שעות שינה' });
    expect(slider).toHaveAttribute('aria-valuetext', "7 ש'");

    await user.tab();
    expect(slider).toHaveFocus();
  });
});
