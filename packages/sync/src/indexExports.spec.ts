import { describe, expect, it } from 'vitest';

import {
  action,
  entity,
  readTrackedUnitSnapshot,
  resetTrackedUnit,
  source,
  stream,
  subscribeTrackedUnit,
} from './index.js';

describe('index named exports', () => {
  describe('happy', () => {
    it('should export entity as named function', () => {
      expect(typeof entity).toBe('function');
    });

    it('should export source as named function', () => {
      expect(typeof source).toBe('function');
    });

    it('should export action as named function', () => {
      expect(typeof action).toBe('function');
    });

    it('should export stream as named function', () => {
      expect(typeof stream).toBe('function');
    });

    it('should export subscribeTrackedUnit as named function', () => {
      expect(typeof subscribeTrackedUnit).toBe('function');
    });

    it('should export readTrackedUnitSnapshot as named function', () => {
      expect(typeof readTrackedUnitSnapshot).toBe('function');
    });

    it('should export resetTrackedUnit as named function', () => {
      expect(typeof resetTrackedUnit).toBe('function');
    });
  });
});
