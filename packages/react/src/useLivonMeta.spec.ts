import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { randomString } from './testing/randomData.js';
import {
  createRandomTodo,
  createReadTodoSource,
  createTodoIdentity,
  type MessageMeta,
} from './testing/utils/index.js';
import { useLivonMeta } from './useLivonMeta.js';

describe('useLivonMeta()', () => {
  let todoIdentity: ReturnType<typeof createTodoIdentity>;

  const createNextMeta = (): MessageMeta => {
    return {
      severity: randomString({ prefix: 'severity' }),
      text: randomString({ prefix: 'text' }),
    };
  };

  const createSourceWithMeta = (nextMeta: MessageMeta) => {
    return createReadTodoSource({
      run: async ({ set, setMeta }) => {
        setMeta(nextMeta);
        set(createRandomTodo());
      },
    });
  };

  beforeEach(() => {
    todoIdentity = createTodoIdentity();
  });

  it('should return null when no meta was set yet', () => {
    const readTodo = createReadTodoSource({
      run: async () => undefined,
    });

    const unit = readTodo(todoIdentity);
    const { result } = renderHook(() => useLivonMeta(unit));

    expect(result.current).toBeNull();
  });

  it('should return latest meta when load sets meta', async () => {
    const nextMeta = createNextMeta();
    const readTodo = createSourceWithMeta(nextMeta);

    const unit = readTodo(todoIdentity);
    const { result } = renderHook(() => useLivonMeta(unit));

    await act(async () => {
      await unit.getSnapshot().load();
    });

    expect(result.current).toEqual(nextMeta);
  });

  it('should keep same meta instance when rerender does not change snapshot meta', async () => {
    const nextMeta = createNextMeta();
    const readTodo = createSourceWithMeta(nextMeta);

    const unit = readTodo(todoIdentity);
    const { result, rerender } = renderHook(() => useLivonMeta(unit));

    await act(async () => {
      await unit.getSnapshot().load();
    });

    const firstMeta = result.current;

    rerender();

    expect(result.current).toBe(firstMeta);
  });

  it('should not rerender when only value changes and meta stays the same', async () => {
    const readTodo = createReadTodoSource({
      run: async ({ set }) => {
        set(createRandomTodo());
      },
    });
    const unit = readTodo(todoIdentity);
    let renderCount = 0;

    renderHook(() => {
      renderCount += 1;
      return useLivonMeta(unit);
    });

    await act(async () => {
      await unit.getSnapshot().load();
    });

    expect(renderCount).toBe(1);
  });
});
