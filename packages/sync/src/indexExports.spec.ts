import { describe, expect, it } from 'vitest';

import * as sync from './index.js';

describe('index named exports', () => {
  describe('happy', () => {
    it('should export entity as named function', () => {
      expect(typeof sync.entity).toBe('function');
    });

    it('should export source as named function', () => {
      expect(typeof sync.source).toBe('function');
    });

    it('should export action as named function', () => {
      expect(typeof sync.action).toBe('function');
    });

    it('should export stream as named function', () => {
      expect(typeof sync.stream).toBe('function');
    });

    it('should export draft as named function', () => {
      expect(typeof sync.draft).toBe('function');
    });

    it('should export view as named function', () => {
      expect(typeof (sync as Record<string, unknown>).view).toBe('function');
    });

    it('should export transform as named function', () => {
      expect(typeof (sync as Record<string, unknown>).transform).toBe('function');
    });

    it('should export subscribeTrackedUnit as named function', () => {
      expect(typeof sync.subscribeTrackedUnit).toBe('function');
    });

    it('should export readTrackedUnitSnapshot as named function', () => {
      expect(typeof sync.readTrackedUnitSnapshot).toBe('function');
    });

    it('should export resetTrackedUnit as named function', () => {
      expect(typeof sync.resetTrackedUnit).toBe('function');
    });
  });
});
