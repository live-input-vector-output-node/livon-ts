import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  createTemplateSlug,
  createReadUserSource,
} from './testing/utils/index.js';
import { useLivonMeta } from './useLivonMeta.js';
import { useLivonState } from './useLivonState.js';
import { useLivonStatus } from './useLivonStatus.js';
import { useLivonValue } from './useLivonValue.js';

describe('useLivonState()', () => {
  let templateSlug: ReturnType<typeof createTemplateSlug>;

  beforeEach(() => {
    templateSlug = createTemplateSlug();
  });

  it('should return value, status, and meta for the same unit snapshot', () => {
    const readUser = createReadUserSource();
    const unit = readUser(templateSlug);

    const { result } = renderHook(() => {
      return {
        state: useLivonState(unit),
        value: useLivonValue(unit),
        status: useLivonStatus(unit),
        meta: useLivonMeta(unit),
      };
    });

    expect(result.current.state.value).toBe(result.current.value);
    expect(result.current.state.status).toBe(result.current.status);
    expect(result.current.state.meta).toBe(result.current.meta);
  });

  it('should update grouped state when unit value changes', async () => {
    const readUser = createReadUserSource();
    const unit = readUser(templateSlug);
    const { result } = renderHook(() => useLivonState(unit));

    await act(async () => {
      await unit.run();
    });

    expect(result.current.status).toBe('success');
    expect(result.current.value).not.toBeNull();
  });
});
