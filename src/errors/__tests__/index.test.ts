import { describe, expect, it } from 'vitest';
import {
  AppError,
  NotFoundError,
  StorageError,
  SyncError,
  ValidationError,
  isAppError,
} from '../index';

describe('error prototype chain', () => {
  it('keeps subclass instances recognizable as AppError via instanceof', () => {
    // Arrange
    const validation = new ValidationError('bad input');
    const notFound = new NotFoundError('Session', 'abc');
    const storage = new StorageError('disk full');
    const sync = new SyncError('offline');

    // Act / Assert
    expect(validation).toBeInstanceOf(AppError);
    expect(validation).toBeInstanceOf(ValidationError);
    expect(notFound).toBeInstanceOf(AppError);
    expect(storage).toBeInstanceOf(AppError);
    expect(sync).toBeInstanceOf(AppError);
  });

  it('still satisfies the base Error instanceof check', () => {
    // Arrange
    const error = new ValidationError('bad input');

    // Act / Assert
    expect(error).toBeInstanceOf(Error);
  });

  it('isAppError returns true for AppError subclasses and false otherwise', () => {
    // Arrange
    const appError = new SyncError('offline');
    const plainError = new Error('plain');

    // Act / Assert
    expect(isAppError(appError)).toBe(true);
    expect(isAppError(plainError)).toBe(false);
    expect(isAppError('not an error')).toBe(false);
  });

  it('preserves the discriminating name and fields on NotFoundError', () => {
    // Arrange
    const error = new NotFoundError('Template', 't-1');

    // Act / Assert
    expect(error.name).toBe('NotFoundError');
    expect(error.entityName).toBe('Template');
    expect(error.entityId).toBe('t-1');
  });
});
