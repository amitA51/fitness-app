// WorkoutErrorBoundary - Catches errors in workout module and provides recovery options
// Prevents entire app from crashing due to workout-specific errors

import { motion } from 'framer-motion';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logger } from '../../../utils/logger';

// ============================================================
// TYPES
// ============================================================

interface Props {
  children: ReactNode;
  onReset?: () => void;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ============================================================
// ERROR BOUNDARY COMPONENT
// ============================================================

class WorkoutErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error for debugging
    logger.workout.error('WorkoutErrorBoundary caught error', error);
    logger.workout.error('Component stack', errorInfo.componentStack);

    this.setState({ errorInfo });

    // Try to save any workout data before crash
    this.attemptDataRecovery();
  }

  attemptDataRecovery = (): void => {
    try {
      // Try to backup current state
      const currentState = localStorage.getItem('active_workout_v3_state');
      if (currentState) {
        const backupKey = `workout_backup_${Date.now()}`;
        localStorage.setItem(backupKey, currentState);
        // Workout state backed up
      }
    } catch (e) {
      logger.workout.error('Failed to backup workout state', e);
    }
  };

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReset = (): void => {
    // Clear problematic state
    try {
      localStorage.removeItem('active_workout_v3_state');
    } catch (e) {
      logger.workout.error('Failed to clear state', e);
    }

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    this.props.onReset?.();
  };

  handleGoBack = (): void => {
    window.history.back();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[var(--bg-base)] flex flex-col items-center justify-center p-6 z-50">
          {/* Error Icon */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="w-20 h-20 rounded-full bg-[#FF453A]/20 flex items-center justify-center mb-6"
          >
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FF453A"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-2xl font-bold text-white mb-2 text-center"
          >
            {this.props.fallbackTitle || 'משהו השתבש'}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-white/60 text-center mb-8 max-w-sm"
          >
            נתקלנו בבעיה במהלך האימון. הנתונים שלך נשמרו בגיבוי.
          </motion.p>

          {/* Error Details (collapsible) */}
          <motion.details
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="w-full max-w-md mb-6"
          >
            <summary className="text-white/40 text-sm cursor-pointer hover:text-white/60 transition-colors">
              פרטי השגיאה (למפתחים)
            </summary>
            <div className="mt-2 p-3 bg-[var(--color-surface-elevated)] rounded-xl border border-white/10 overflow-auto max-h-32">
              <code className="text-xs text-red-400 font-mono whitespace-pre-wrap">
                {this.state.error?.message || 'Unknown error'}
              </code>
            </div>
          </motion.details>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col gap-3 w-full max-w-xs"
          >
            {/* Try Again */}
            <button
              onClick={this.handleRetry}
              className="
                                w-full py-4 rounded-2xl
                                bg-[var(--fs-accent)] text-black
                                font-bold text-base
                                shadow-lg shadow-[var(--fs-accent)]/20
                                active:scale-[0.98] transition-transform
                            "
            >
              נסה שוב
            </button>

            {/* Reset Workout */}
            <button
              onClick={this.handleReset}
              className="
                                w-full py-4 rounded-2xl
                                bg-[var(--bg-elevated)] text-white/80
                                font-semibold text-base
                                border border-white/10
                                hover:bg-[var(--bg-hover)] active:scale-[0.98] transition-all
                            "
            >
              אפס ונסה מחדש
            </button>

            {/* Go Back */}
            <button
              onClick={this.handleGoBack}
              className="
                                w-full py-3 rounded-xl
                                text-white/50 font-medium text-sm
                                hover:text-white/70 active:scale-[0.98] transition-all
                            "
            >
              חזור למסך הקודם
            </button>
          </motion.div>

          {/* Recovery Info */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-white/30 text-xs text-center mt-8 max-w-sm"
          >
            נתוני האימון שלך נשמרו באופן אוטומטי. אם הבעיה חוזרת, נסה לאפס את האימון.
          </motion.p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WorkoutErrorBoundary;
