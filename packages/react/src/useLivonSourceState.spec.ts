import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createReadUserSource, createTemplateSlug } from './testing/utils/index.js';
import { useLivonSourceState } from './useLivonSourceState.js';

describe('useLivonSourceState()', () => {
  let templateSlug: ReturnType<typeof createTemplateSlug>;

  beforeEach(() => {
    templateSlug = createTemplateSlug();
  });

  it('should expose source run capability', async () => {
    const readUser = createReadUserSource();
    const unit = readUser(templateSlug);
    const runSpy = vi.spyOn(unit, 'run');

    const { result } = renderHook(() => useLivonSourceState(unit));

    await act(async () => {
      await result.current.run();
    });

    expect(runSpy).toHaveBeenCalledTimes(1);
  });
});
