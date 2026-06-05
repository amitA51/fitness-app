import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GUIDANCE_KEYS,
  dismissHint,
  hasSeenWelcome,
  isHintDismissed,
  markWelcomeSeen,
  resetGuidance,
} from '../guidanceService';

describe('guidanceService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('welcome flag', () => {
    it('reports unseen before the welcome has been marked', () => {
      expect(hasSeenWelcome()).toBe(false);
    });

    it('reports seen after markWelcomeSeen and persists the flag', () => {
      markWelcomeSeen();
      expect(hasSeenWelcome()).toBe(true);
      expect(localStorage.getItem(GUIDANCE_KEYS.welcomeSeen)).toBe('true');
    });
  });

  describe('contextual hints', () => {
    it('reports each hint as not dismissed by default', () => {
      expect(isHintDismissed('hintDashboard')).toBe(false);
      expect(isHintDismissed('hintWorkout')).toBe(false);
      expect(isHintDismissed('hintNutrition')).toBe(false);
    });

    it('dismisses a single hint without affecting the others', () => {
      dismissHint('hintDashboard');
      expect(isHintDismissed('hintDashboard')).toBe(true);
      expect(isHintDismissed('hintWorkout')).toBe(false);
      expect(isHintDismissed('hintNutrition')).toBe(false);
    });
  });

  describe('resetGuidance', () => {
    it('clears the welcome flag and every dismissed hint', () => {
      markWelcomeSeen();
      dismissHint('hintDashboard');
      dismissHint('hintWorkout');
      dismissHint('hintNutrition');

      resetGuidance();

      expect(hasSeenWelcome()).toBe(false);
      expect(isHintDismissed('hintDashboard')).toBe(false);
      expect(isHintDismissed('hintWorkout')).toBe(false);
      expect(isHintDismissed('hintNutrition')).toBe(false);
    });
  });

  describe('localStorage failure handling', () => {
    it('returns false from reads when getItem throws', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage disabled');
      });
      expect(hasSeenWelcome()).toBe(false);
      expect(isHintDismissed('hintDashboard')).toBe(false);
    });

    it('does not throw when setItem throws', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota exceeded');
      });
      expect(() => markWelcomeSeen()).not.toThrow();
      expect(() => dismissHint('hintNutrition')).not.toThrow();
    });

    it('does not throw when removeItem throws during reset', () => {
      vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
        throw new Error('storage disabled');
      });
      expect(() => resetGuidance()).not.toThrow();
    });
  });
});
