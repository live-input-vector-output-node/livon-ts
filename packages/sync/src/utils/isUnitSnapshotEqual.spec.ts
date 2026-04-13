import { describe, expect, it } from 'vitest';

import { isUnitSnapshotEqual } from './isUnitSnapshotEqual.js';
import type { UnitSnapshot } from './types.js';

interface User {
  id: string;
  name: string;
}

type UserSnapshot = UnitSnapshot<User | null, { severity: string } | null>;

describe('isUnitSnapshotEqual()', () => {
  describe('happy', () => {
    it('should return true for snapshots with shallow-equal object fields', () => {
      const left: UserSnapshot = {
        value: {
          id: 'user-1',
          name: 'Alice',
        },
        status: 'success',
        meta: {
          severity: 'info',
        },
        context: {
          cacheState: 'hit',
        },
      };
      const right: UserSnapshot = {
        value: {
          id: 'user-1',
          name: 'Alice',
        },
        status: 'success',
        meta: {
          severity: 'info',
        },
        context: {
          cacheState: 'hit',
        },
      };

      expect(isUnitSnapshotEqual({
        left,
        right,
      })).toBe(true);
    });

    it('should return false when a shallow field changes', () => {
      const left: UserSnapshot = {
        value: {
          id: 'user-1',
          name: 'Alice',
        },
        status: 'success',
        meta: {
          severity: 'info',
        },
        context: {
          cacheState: 'hit',
        },
      };
      const right: UserSnapshot = {
        value: {
          id: 'user-1',
          name: 'Alice-2',
        },
        status: 'success',
        meta: {
          severity: 'info',
        },
        context: {
          cacheState: 'hit',
        },
      };

      expect(isUnitSnapshotEqual({
        left,
        right,
      })).toBe(false);
    });

    it('should compare arrays shallowly', () => {
      const left: UnitSnapshot<readonly string[], null> = {
        value: ['a', 'b'],
        status: 'success',
        meta: null,
        context: null,
      };
      const right: UnitSnapshot<readonly string[], null> = {
        value: ['a', 'b'],
        status: 'success',
        meta: null,
        context: null,
      };

      expect(isUnitSnapshotEqual({
        left,
        right,
      })).toBe(true);
    });
  });
});
