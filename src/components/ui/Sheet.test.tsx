import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Sheet } from './Sheet';

describe('Sheet', () => {
  it('uses the visible title as the accessible dialog name', () => {
    render(
      <Sheet isOpen title="עדכון מדדים" onClose={vi.fn()}>
        <p>תוכן</p>
      </Sheet>
    );

    const dialog = screen.getByRole('dialog', { name: 'עדכון מדדים' });
    expect(dialog).toBeInTheDocument();
    expect(dialog).not.toHaveAccessibleDescription('עדכון מדדים');
  });
});
