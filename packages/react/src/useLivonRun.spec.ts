import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createCreateUserAction,
  createRandomUser,
  createReadUserSource,
  createTemplateSlug,
  createUserUpdatedStream,
} from './testing/utils/index.js';
import { useLivonRun } from './useLivonRun.js';

describe('useLivonRun()', () => {
  let templateSlug: ReturnType<typeof createTemplateSlug>;

  beforeEach(() => {
    templateSlug = createTemplateSlug();
  });

  it('should invoke source run when returned function is executed', async () => {
    const runMock = vi.fn(async () => {
      return createRandomUser();
    });

    const readUser = createReadUserSource({
      run: runMock,
    });

    const unit = readUser(templateSlug);
    const { result } = renderHook(() => useLivonRun(unit));

    await act(async () => {
      await result.current();
    });

    expect(runMock).toHaveBeenCalledTimes(1);
  });

  it('should invoke action run when returned function is executed', async () => {
    const runMock = vi.fn(async ({ payload }) => {
      return { id: payload.id, name: payload.name };
    });

    const createUser = createCreateUserAction({
      run: runMock,
    });

    const unit = createUser(templateSlug);
    const createPayload = createRandomUser({
      idPrefix: 'create-id',
      namePrefix: 'create-name',
    });

    const { result } = renderHook(() => useLivonRun(unit));

    await act(async () => {
      await result.current(createPayload);
    });

    expect(runMock).toHaveBeenCalledTimes(1);
  });

  it('should invoke stream start when returned function runs on a stream unit', () => {
    const runMock = vi.fn(async () => {
      return () => undefined;
    });

    const onUserUpdated = createUserUpdatedStream({
      run: runMock,
    });

    const unit = onUserUpdated(templateSlug);
    const streamPayload = createRandomUser({
      idPrefix: 'stream-id',
      namePrefix: 'stream-name',
    });

    const { result } = renderHook(() => useLivonRun(unit));

    act(() => {
      result.current(streamPayload);
    });

    expect(runMock).toHaveBeenCalledTimes(1);
  });

  it('should return same run function instance when hook rerenders with same unit', () => {
    const readUser = createReadUserSource();
    const unit = readUser(templateSlug);
    const { result, rerender } = renderHook(() => useLivonRun(unit));
    const firstRun = result.current;

    rerender();

    expect(result.current).toBe(firstRun);
  });
});
