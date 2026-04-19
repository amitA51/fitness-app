import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageErrorBoundary } from '../PageErrorBoundary';

// Silence the expected React error logs that come from a child throwing.
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {}) as typeof errorSpy;
});

afterEach(() => {
  errorSpy.mockRestore();
});

function Bomb(): JSX.Element {
  throw new Error('kaboom');
}

describe('PageErrorBoundary', () => {
  it('renders children when no error is thrown', () => {
    render(
      <PageErrorBoundary pageLabel="Workouts">
        <div>safe content</div>
      </PageErrorBoundary>
    );
    expect(screen.getByText('safe content')).toBeInTheDocument();
  });

  it('renders fallback UI when child throws', () => {
    render(
      <PageErrorBoundary pageLabel="Workouts">
        <Bomb />
      </PageErrorBoundary>
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent('Workouts');
    expect(screen.getByRole('button', { name: /נסה שוב/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /רענן דף/ })).toBeInTheDocument();
  });

  it('invokes onReset when the retry button is clicked', async () => {
    const onReset = vi.fn();
    const user = userEvent.setup();

    render(
      <PageErrorBoundary pageLabel="Workouts" onReset={onReset}>
        <Bomb />
      </PageErrorBoundary>
    );

    await user.click(screen.getByRole('button', { name: /נסה שוב/ }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
