// OverlayErrorBoundary - Lightweight error boundary for individual overlays
// Catches errors in overlays/modals without crashing the entire workout

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '../../../utils/logger';

interface Props {
  children: ReactNode;
  /** What to show when the overlay crashes */
  fallbackLabel?: string;
  /** Called when user dismisses the error */
  onDismiss?: () => void;
}

interface State {
  hasError: boolean;
}

/**
 * Lightweight boundary for overlays. If a tutorial/settings/coach crashes,
 * the user can dismiss and continue their workout.
 */
class OverlayErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.ui.error(`${this.props.fallbackLabel || 'Overlay'}: ${error.message}`, error);
    logger.ui.error('Stack', info.componentStack);
  }

  handleDismiss = (): void => {
    this.setState({ hasError: false });
    this.props.onDismiss?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-black/90 z-[12000] flex items-center justify-center p-6">
          <div className="bg-[var(--bg-card)] rounded-2xl p-6 max-w-sm w-full text-center border border-white/10">
            <div className="text-3xl mb-3" aria-hidden="true">!</div>
            <h3 className="text-white font-bold text-lg mb-2">
              {this.props.fallbackLabel || 'שגיאה'}
            </h3>
            <p className="text-white/60 text-sm mb-5">משהו השתבש. האימון שלך לא נפגע.</p>
            <button
              onClick={this.handleDismiss}
              className="w-full py-3 rounded-xl bg-[var(--cosmos-accent-primary,#a3e635)] text-black font-bold active:scale-[0.98] transition-transform"
            >
              סגור וחזור לאימון
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default OverlayErrorBoundary;
