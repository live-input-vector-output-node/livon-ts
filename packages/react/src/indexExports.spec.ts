import { describe, expect, it } from 'vitest';

import {
  useLivonMeta,
  useLivonState,
  useLivonStatus,
  useLivonValue,
} from './index.js';

describe('index named exports', () => {
  it.each([
    ['useLivonValue', useLivonValue],
    ['useLivonStatus', useLivonStatus],
    ['useLivonMeta', useLivonMeta],
    ['useLivonState', useLivonState],
  ])('should export %s when index module is imported', (_name, exportedValue) => {
    expect(typeof exportedValue).toBe('function');
  });
});
