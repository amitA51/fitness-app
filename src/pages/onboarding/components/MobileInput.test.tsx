import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MobileInput } from './MobileInput';

describe('MobileInput', () => {
  it('keeps a trailing decimal draft while typing and commits the number on blur', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <MobileInput
        type="number"
        value=""
        onChange={onChange}
        label="משקל נוכחי"
        inputMode="decimal"
        step="0.1"
      />
    );

    const input = screen.getByLabelText('משקל נוכחי');
    await act(async () => {
      await user.type(input, '70.');
    });

    expect(input).toHaveDisplayValue('70.');
    expect(onChange).not.toHaveBeenCalled();

    await act(async () => {
      await user.tab();
    });

    expect(onChange).toHaveBeenCalledWith(70);
  });
});
