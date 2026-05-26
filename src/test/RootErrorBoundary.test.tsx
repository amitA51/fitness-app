import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RootErrorBoundary } from '../errors/RootErrorBoundary';

vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}));

describe('RootErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <RootErrorBoundary>
        <div>Test Content</div>
      </RootErrorBoundary>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('renders error UI when child throws', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <RootErrorBoundary>
        <ThrowError />
      </RootErrorBoundary>
    );

    expect(screen.getByText('אירעה שגיאה קריטית')).toBeInTheDocument();
    expect(screen.getByText('נסה שוב')).toBeInTheDocument();
    expect(screen.getByText('רענן דף')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('calls Sentry.captureException when error occurs', async () => {
    const { captureException } = await import('@sentry/react');
    const ThrowError = () => {
      throw new Error('Sentry test error');
    };

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <RootErrorBoundary>
        <ThrowError />
      </RootErrorBoundary>
    );

    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        contexts: expect.objectContaining({
          react: expect.objectContaining({
            componentStack: expect.any(String),
          }),
        }),
      })
    );

    consoleSpy.mockRestore();
  });
});
