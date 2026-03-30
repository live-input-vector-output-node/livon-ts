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

  it('should expose action run capability', async () => {
    const createUser = createCreateUserAction();
    const unit = createUser(templateSlug);
    const runSpy = vi.spyOn(unit, 'run');
    const userPayload = createRandomUser({
      idPrefix: 'action-id',
      namePrefix: 'action-name',
    });

    const { result } = renderHook(() => useLivonActionState(unit));

    await act(async () => {
      await result.current.run(userPayload);
    });

    expect(runSpy).toHaveBeenCalledTimes(1);
  });
});
