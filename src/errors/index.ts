// ============================================================================
// SPARKOS FITNESS - Errors Index
// ============================================================================

export { PageErrorBoundary } from './PageErrorBoundary';

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  entityName: string;
  entityId: string;

  constructor(entityName: string, entityId: string) {
    super(`${entityName} with id "${entityId}" not found`);
    this.name = 'NotFoundError';
    this.entityName = entityName;
    this.entityId = entityId;
  }
}

export class StorageError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

export class SyncError extends AppError {
  constructor(message: string) {
    super(message);
    this.name = 'SyncError';
  }
}

export const isAppError = (error: unknown): error is AppError => {
  return error instanceof AppError;
};
