import { describe, expect, it } from 'vitest';

import {
  useLivonActionState,
  useLivonDraft,
  useLivonMeta,
  useLivonRun,
  useLivonSourceState,
  useLivonState,
  useLivonStatus,
  useLivonStop,
  useLivonStreamState,
  useLivonValue,
} from './index.js';

describe('index named exports', () => {
  it.each([
    ['useLivonValue', useLivonValue],
    ['useLivonStatus', useLivonStatus],
    ['useLivonMeta', useLivonMeta],
    ['useLivonDraft', useLivonDraft],
    ['useLivonRun', useLivonRun],
    ['useLivonStop', useLivonStop],
    ['useLivonState', useLivonState],
    ['useLivonSourceState', useLivonSourceState],
    ['useLivonActionState', useLivonActionState],
    ['useLivonStreamState', useLivonStreamState],
  ])('should export %s when index module is imported', (_name, exportedValue) => {
    expect(typeof exportedValue).toBe('function');
  });
});
