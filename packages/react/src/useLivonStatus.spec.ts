import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  createRandomTodo,
  createReadTodoSource,
  createTodoIdentity,
} from './testing/utils/index.js';
import { useLivonStatus } from './useLivonStatus.js';

describe('useLivonStatus()', () => {
  let todoIdentity: ReturnType<typeof createTodoIdentity>;

  beforeEach(() => {
    todoIdentity = createTodoIdentity();
  });

  it('should return idle when load has not been called', () => {
    const readTodo = createReadTodoSource();
    const unit = readTodo(todoIdentity);

    const { result } = renderHook(() => useLivonStatus(unit));

    expect(result.current).toBe('idle');
  });

  it('should return success when load resolves', async () => {
    const readTodo = createReadTodoSource({
      run: async ({ set }) => {
        await Promise.resolve();
        set(createRandomTodo({
          idPrefix: 'resolved-id',
          titlePrefix: 'resolved-title',
        }));
      },
    });

    const unit = readTodo(todoIdentity);
    const { result } = renderHook(() => useLivonStatus(unit));

    await act(async () => {
      await unit.getSnapshot().load();
    });

    expect(result.current).toBe('success');
  });

  it('should keep same status value when rerender does not change snapshot status', () => {
    const readTodo = createReadTodoSource();
    const unit = readTodo(todoIdentity);
    const { result, rerender } = renderHook(() => useLivonStatus(unit));
    const firstStatus = result.current;

    rerender();

    expect(result.current).toBe(firstStatus);
  });
});
