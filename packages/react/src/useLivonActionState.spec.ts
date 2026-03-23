import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createCreateUserAction,
  createRandomUser,
  createTemplateSlug,
} from './testing/utils/index.js';
import { useLivonActionState } from './useLivonActionState.js';

describe('useLivonActionState()', () => {
  let templateSlug: ReturnType<typeof createTemplateSlug>;

  beforeEach(() => {
    templateSlug = createTemplateSlug();
  });

  it('should expose action run/stop capabilities', async () => {
    const createUser = createCreateUserAction();
    const unit = createUser(templateSlug);
    const runSpy = vi.spyOn(unit, 'run');
    const stopSpy = vi.spyOn(unit, 'stop');
    const userPayload = createRandomUser({
      idPrefix: 'action-id',
      namePrefix: 'action-name',
    });

    const { result } = renderHook(() => useLivonActionState(unit));

    await act(async () => {
      await result.current.run(userPayload);
    });

    act(() => {
      result.current.stop();
    });

    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });
});
