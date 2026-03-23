import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { randomString } from './testing/randomData.js';
import { createReadUserSource, createTemplateSlug } from './testing/utils/index.js';
import { useLivonValue } from './useLivonValue.js';

describe('useLivonValue()', () => {
  let templateSlug: ReturnType<typeof createTemplateSlug>;

  beforeEach(() => {
    templateSlug = createTemplateSlug();
  });

  it('should return current unit value when hook mounts', () => {
    const readUser = createReadUserSource();
    const unit = readUser(templateSlug);

    const { result } = renderHook(() => useLivonValue(unit));

    expect(result.current).toBeNull();
  });

  it('should rerender with next value when source run updates unit value', async () => {
    const nextId = randomString({ prefix: 'next-user-id' });
    const nextName = randomString({ prefix: 'next-user-name' });

    const readUser = createReadUserSource({
      run: async () => {
        return {
          id: nextId,
          name: nextName,
        };
      },
    });

    const unit = readUser(templateSlug);
    const { result } = renderHook(() => useLivonValue(unit));

    await act(async () => {
      await unit.run();
    });

    expect(result.current).toEqual({
      id: nextId,
      name: nextName,
    });
  });

  it('should keep same value instance when rerender does not change snapshot value', async () => {
    const nextId = randomString({ prefix: 'next-user-id' });
    const nextName = randomString({ prefix: 'next-user-name' });

    const readUser = createReadUserSource({
      run: async () => {
        return {
          id: nextId,
          name: nextName,
        };
      },
    });

    const unit = readUser(templateSlug);
    const { result, rerender } = renderHook(() => useLivonValue(unit));

    await act(async () => {
      await unit.run();
    });

    const firstValue = result.current;

    rerender();

    expect(result.current).toBe(firstValue);
  });

  it('should not emit console errors when async run resolves after hook unmount', async () => {
    let releaseRun: (() => void) | undefined;
    const nextId = randomString({ prefix: 'next-user-id' });
    const nextName = randomString({ prefix: 'next-user-name' });

    const readUser = createReadUserSource({
      run: async () => {
        await new Promise<void>((resolve) => {
          releaseRun = resolve;
        });

        return {
          id: nextId,
          name: nextName,
        };
      },
    });

    const unit = readUser(templateSlug);
    const { unmount } = renderHook(() => useLivonValue(unit));
    const runPromise = unit.run();

    unmount();
    releaseRun?.();

    await expect(act(async () => {
      await runPromise;
    })).resolves.toBeUndefined();
  });
});
