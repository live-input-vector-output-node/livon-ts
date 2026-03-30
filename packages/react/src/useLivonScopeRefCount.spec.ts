import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createReadTodoSource,
  createTodoIdentity,
} from './testing/utils/index.js';
import { useLivonStatus } from './useLivonStatus.js';
import { useLivonValue } from './useLivonValue.js';

describe('useLivon subscriptions', () => {
  it('should subscribe and unsubscribe once for a single hook lifecycle', () => {
    const readTodo = createReadTodoSource();
    const unit = readTodo(createTodoIdentity());
    const removeSpy = vi.fn();
    const subscribeSpy = vi.spyOn(unit, 'subscribe')
      .mockImplementation((listener) => {
        listener(unit.getSnapshot());
        return removeSpy;
      });

    const hook = renderHook(() => useLivonValue(unit));
    hook.unmount();

    expect(subscribeSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('should create one subscription per mounted hook', () => {
    const readTodo = createReadTodoSource();
    const unit = readTodo(createTodoIdentity());
    const removeSpy = vi.fn();
    const subscribeSpy = vi.spyOn(unit, 'subscribe')
      .mockImplementation((listener) => {
        listener(unit.getSnapshot());
        return removeSpy;
      });

    const first = renderHook(() => useLivonValue(unit));
    const second = renderHook(() => useLivonStatus(unit));

    first.unmount();
    second.unmount();

    expect(subscribeSpy).toHaveBeenCalledTimes(2);
    expect(removeSpy).toHaveBeenCalledTimes(2);
  });
});
