import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createCreateUserAction,
  createRandomUser,
  createReadUserSource,
  createTemplateSlug,
  createUserUpdatedStream,
} from './testing/utils/index.js';
import { useLivonStop } from './useLivonStop.js';

describe('useLivonStop()', () => {
  let templateSlug: ReturnType<typeof createTemplateSlug>;

  beforeEach(() => {
    templateSlug = createTemplateSlug();
  });

  const createStartedStreamUnit = (unsubscribe: () => void) => {
    const onUserUpdated = createUserUpdatedStream({
      run: async () => {
        return () => {
          unsubscribe();
        };
      },
    });

    const unit = onUserUpdated(templateSlug);
    const payload = createRandomUser({
      idPrefix: 'stream-id',
      namePrefix: 'stream-name',
    });
    unit.start(payload);

    return unit;
  };

  it('should invoke stream stop when returned function is executed', async () => {
    const unsubscribeSpy = vi.fn();
    const unit = createStartedStreamUnit(() => {
      unsubscribeSpy();
    });

    const { result } = renderHook(() => useLivonStop(unit));

    act(() => {
      result.current();
    });
    await Promise.resolve();

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
  });

  it('should invoke source stop when returned function is executed', () => {
    const readUser = createReadUserSource();
    const unit = readUser(templateSlug);
    const stopSpy = vi.spyOn(unit, 'stop');
    const { result } = renderHook(() => useLivonStop(unit));

    act(() => {
      result.current();
    });

    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  it('should invoke action stop when returned function is executed', () => {
    const createUser = createCreateUserAction();
    const unit = createUser(templateSlug);
    const stopSpy = vi.spyOn(unit, 'stop');
    const { result } = renderHook(() => useLivonStop(unit));

    act(() => {
      result.current();
    });

    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  it('should keep stop idempotent when returned function is executed twice', async () => {
    const unsubscribeSpy = vi.fn();
    const unit = createStartedStreamUnit(() => {
      unsubscribeSpy();
    });

    const { result } = renderHook(() => useLivonStop(unit));

    act(() => {
      result.current();
      result.current();
    });
    await Promise.resolve();

    expect(unsubscribeSpy).toHaveBeenCalledTimes(1);
  });

  it('should return same stop function instance when hook rerenders with same stream unit', () => {
    const onUserUpdated = createUserUpdatedStream();
    const unit = onUserUpdated(templateSlug);
    const { result, rerender } = renderHook(() => useLivonStop(unit));
    const firstStop = result.current;

    rerender();

    expect(result.current).toBe(firstStop);
  });
});
