import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { randomString } from './testing/randomData.js';
import { createReadTodoSource, createTodoIdentity } from './testing/utils/index.js';
import { useLivonValue } from './useLivonValue.js';

describe('useLivonValue()', () => {
  let todoIdentity: ReturnType<typeof createTodoIdentity>;

  beforeEach(() => {
    todoIdentity = createTodoIdentity();
  });

  it('should return current unit value when hook mounts', () => {
    const readTodo = createReadTodoSource();
    const unit = readTodo(todoIdentity);

    const { result } = renderHook(() => useLivonValue(unit));

    expect(result.current).toBeNull();
  });

  it('should rerender with next value when source load updates unit value', async () => {
    const nextId = randomString({ prefix: 'next-todo-id' });
    const nextTitle = randomString({ prefix: 'next-todo-name' });

    const readTodo = createReadTodoSource({
      run: async ({ set }) => {
        set({
          id: nextId,
          title: nextTitle,
        });
      },
    });

    const unit = readTodo(todoIdentity);
    const { result } = renderHook(() => useLivonValue(unit));

    await act(async () => {
      await unit.getSnapshot().load();
    });

    expect(result.current).toEqual({
      id: nextId,
      title: nextTitle,
    });
  });

  it('should keep same value instance when rerender does not change snapshot value', async () => {
    const nextId = randomString({ prefix: 'next-todo-id' });
    const nextTitle = randomString({ prefix: 'next-todo-name' });

    const readTodo = createReadTodoSource({
      run: async ({ set }) => {
        set({
          id: nextId,
          title: nextTitle,
        });
      },
    });

    const unit = readTodo(todoIdentity);
    const { result, rerender } = renderHook(() => useLivonValue(unit));

    await act(async () => {
      await unit.getSnapshot().load();
    });

    const firstValue = result.current;

    rerender();

    expect(result.current).toBe(firstValue);
  });

  it('should not rerender when only meta changes and value stays the same', async () => {
    const readTodo = createReadTodoSource({
      run: async ({ setMeta }) => {
        setMeta({
          severity: 'info',
          text: 'meta-only-update',
        });
      },
    });
    const unit = readTodo(todoIdentity);
    let renderCount = 0;

    renderHook(() => {
      renderCount += 1;
      return useLivonValue(unit);
    });

    await act(async () => {
      await unit.getSnapshot().load();
    });

    expect(renderCount).toBe(1);
  });

  it('should not emit console errors when async load resolves after hook unmount', async () => {
    let releaseRun: (() => void) | undefined;
    const nextId = randomString({ prefix: 'next-todo-id' });
    const nextTitle = randomString({ prefix: 'next-todo-name' });
    const waitForReleaseRun = async (): Promise<() => void> => {
      if (releaseRun) {
        return releaseRun;
      }

      await Promise.resolve();
      return waitForReleaseRun();
    };

    const readTodo = createReadTodoSource({
      run: async ({ set }) => {
        await new Promise<void>((resolve) => {
          releaseRun = resolve;
        });

        set({
          id: nextId,
          title: nextTitle,
        });
      },
    });

    const unit = readTodo(todoIdentity);
    const { unmount } = renderHook(() => useLivonValue(unit));
    const runPromise = unit.getSnapshot().load();
    const unblockRun = await waitForReleaseRun();

    unmount();
    unblockRun();

    await expect(act(async () => {
      await runPromise;
    })).resolves.toBeUndefined();
  });
});
