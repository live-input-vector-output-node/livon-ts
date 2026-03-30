import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  createTodoIdentity,
  createReadTodoSource,
} from './testing/utils/index.js';
import { useLivonMeta } from './useLivonMeta.js';
import { useLivonState } from './useLivonState.js';
import { useLivonStatus } from './useLivonStatus.js';
import { useLivonValue } from './useLivonValue.js';

describe('useLivonState()', () => {
  let todoIdentity: ReturnType<typeof createTodoIdentity>;

  beforeEach(() => {
    todoIdentity = createTodoIdentity();
  });

  it('should return the full unit snapshot while preserving value/status/meta parity', () => {
    const readTodo = createReadTodoSource();
    const unit = readTodo(todoIdentity);
    const snapshot = unit.getSnapshot();

    const { result } = renderHook(() => {
      return {
        state: useLivonState(unit),
        value: useLivonValue(unit),
        status: useLivonStatus(unit),
        meta: useLivonMeta(unit),
      };
    });

    expect(result.current.state).toBe(snapshot);
    expect(result.current.state.value).toBe(result.current.value);
    expect(result.current.state.status).toBe(result.current.status);
    expect(result.current.state.meta).toBe(result.current.meta);
    expect(typeof result.current.state.load).toBe('function');
  });

  it('should update grouped state when unit value changes', async () => {
    const readTodo = createReadTodoSource();
    const unit = readTodo(todoIdentity);
    const { result } = renderHook(() => useLivonState(unit));

    await act(async () => {
      await unit.getSnapshot().load();
    });

    expect(result.current.status).toBe('success');
    expect(result.current.value).not.toBeNull();
  });
});
