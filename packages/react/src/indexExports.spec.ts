import { describe, expect, it } from 'vitest';

import {
  useLivonDraft,
  useLivonMeta,
  useLivonRun,
  useLivonStatus,
  useLivonStop,
  useLivonValue,
} from './index.js';

describe('index named exports', () => {
  it('should export useLivonValue when index module is imported', () => {
    expect(typeof useLivonValue).toBe('function');
  });

  it('should export useLivonStatus when index module is imported', () => {
    expect(typeof useLivonStatus).toBe('function');
  });

  it('should export useLivonMeta when index module is imported', () => {
    expect(typeof useLivonMeta).toBe('function');
  });

  it('should export useLivonDraft when index module is imported', () => {
    expect(typeof useLivonDraft).toBe('function');
  });

  it('should export useLivonRun when index module is imported', () => {
    expect(typeof useLivonRun).toBe('function');
  });

  it('should export useLivonStop when index module is imported', () => {
    expect(typeof useLivonStop).toBe('function');
  });
});
