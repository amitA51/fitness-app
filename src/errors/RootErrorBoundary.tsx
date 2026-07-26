import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureException } from '../lib/sentryLazy';
import { logger } from '../utils/logger';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class RootErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.app.error('RootErrorBoundary caught error', {
      message: error.message,
      stack: info.componentStack,
    });

    try {
      captureException(error, {
        contexts: {
          react: {
            componentStack: info.componentStack,
          },
        },
      });
    } catch {
      // Sentry not initialized
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        dir="rtl"
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'var(--fs-bg, #EEF3F1)',
          color: 'var(--fs-ink, #2C2C2E)',
          fontFamily: 'var(--font-hebrew, system-ui, sans-serif)',
        }}
      >
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '24px',
            background: 'color-mix(in srgb, var(--color-error, #b83228) 12%, transparent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px',
          }}
        >
          <AlertTriangle size={40} style={{ color: 'var(--color-error, #b83228)' }} />
        </div>
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 700,
            marginBottom: '12px',
            textAlign: 'center',
          }}
        >
          אירעה שגיאה קריטית
        </h1>
        <p
          style={{
            fontSize: '16px',
            color: 'var(--fs-muted, #6B7280)',
            maxWidth: '400px',
            textAlign: 'center',
            marginBottom: '32px',
            lineHeight: 1.5,
          }}
        >
          אירעה בעיה בלתי צפויה וייתכן שהפעולה האחרונה לא הושלמה. נסו לרענן את הדף.
        </p>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 600,
              background: 'var(--fs-primary, #16292d)',
              color: 'var(--color-ink-on-dark, #ffffff)',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
            }}
          >
            <RefreshCcw size={18} />
            נסו שוב
          </button>
          <button
            type="button"
            onClick={this.handleReload}
            style={{
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: 600,
              background: 'transparent',
              color: 'var(--fs-ink, #2C2C2E)',
              border: '2px solid var(--fs-surface-2, #D1D5DB)',
              borderRadius: '12px',
              cursor: 'pointer',
            }}
          >
            רענן דף
          </button>
        </div>
      </div>
    );
  }
}
