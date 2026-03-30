import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createRandomUser,
  createTemplateSlug,
  createUserUpdatedStream,
} from './testing/utils/index.js';
import { useLivonStreamState } from './useLivonStreamState.js';

describe('useLivonStreamState()', () => {
  let templateSlug: ReturnType<typeof createTemplateSlug>;

  beforeEach(() => {
    templateSlug = createTemplateSlug();
  });

  it('should expose stream run capability', async () => {
    const onUserUpdated = createUserUpdatedStream();
    const unit = onUserUpdated(templateSlug);
    const runSpy = vi.spyOn(unit, 'run');
    const payload = createRandomUser({
      idPrefix: 'stream-id',
      namePrefix: 'stream-name',
    });

    const { result } = renderHook(() => useLivonStreamState(unit));

    await act(async () => {
      await result.current.run(payload);
    });

    expect(runSpy).toHaveBeenCalledTimes(1);
  });
});
