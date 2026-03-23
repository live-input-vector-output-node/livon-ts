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

  it('should expose stream start/stop capabilities', async () => {
    const onUserUpdated = createUserUpdatedStream();
    const unit = onUserUpdated(templateSlug);
    const startSpy = vi.spyOn(unit, 'start');
    const stopSpy = vi.spyOn(unit, 'stop');
    const payload = createRandomUser({
      idPrefix: 'stream-id',
      namePrefix: 'stream-name',
    });

    const { result } = renderHook(() => useLivonStreamState(unit));

    act(() => {
      result.current.start(payload);
      result.current.stop();
    });
    await Promise.resolve();

    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });
});
