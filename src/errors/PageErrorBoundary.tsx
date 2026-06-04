import * as Sentry from '@sentry/react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '../utils/logger';

interface PageErrorBoundaryProps {
  children: ReactNode;
  pageLabel: string;
  onReset?: () => void;
}

interface PageErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.app.error(`PageErrorBoundary [${this.props.pageLabel}]`, {
      message: error.message,
      stack: info.componentStack,
    });

    try {
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: info.componentStack,
          },
        },
        tags: { page: this.props.pageLabel },
      });
    } catch {
      // Sentry not initialized
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        dir="rtl"
        role="alert"
        className="min-h-[60vh] flex flex-col items-center justify-center px-6 text-center"
      >
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'color-mix(in srgb, var(--color-error) 12%, transparent)' }}
        >
          <AlertTriangle size={24} style={{ color: 'var(--color-error)' }} />
        </div>
        <h2 className="text-[18px] font-bold text-[var(--color-text)] mb-1">
          משהו השתבש ב{this.props.pageLabel}
        </h2>
        <p className="text-[13px] text-[var(--color-text-secondary)] max-w-[280px] mb-5">
          הנתונים שלך בטוחים. אפשר לנסות שוב או לרענן את הדף.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={this.handleReset} className="btn-primary gap-2 px-4 py-2">
            <RefreshCcw size={14} />
            נסה שוב
          </button>
          <button
            type="button"
            onClick={this.handleReload}
            className="btn-secondary px-4 py-2 text-[13px]"
          >
            רענן דף
          </button>
        </div>
      </div>
    );
  }
}

export default PageErrorBoundary;
