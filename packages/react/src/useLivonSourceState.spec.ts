import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createReadUserSource, createTemplateSlug } from './testing/utils/index.js';
import { useLivonSourceState } from './useLivonSourceState.js';

describe('useLivonSourceState()', () => {
  let templateSlug: ReturnType<typeof createTemplateSlug>;

  beforeEach(() => {
    templateSlug = createTemplateSlug();
  });

  it('should expose source run/refetch/force/reset/stop capabilities', async () => {
    const readUser = createReadUserSource();
    const unit = readUser(templateSlug);
    const runSpy = vi.spyOn(unit, 'run');
    const refetchSpy = vi.spyOn(unit, 'refetch');
    const forceSpy = vi.spyOn(unit, 'force');
    const resetSpy = vi.spyOn(unit, 'reset');
    const stopSpy = vi.spyOn(unit, 'stop');

    const { result } = renderHook(() => useLivonSourceState(unit));

    await act(async () => {
      await result.current.run();
      await result.current.refetch();
      await result.current.force();
    });

    act(() => {
      result.current.reset();
      result.current.stop();
    });

    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(refetchSpy).toHaveBeenCalledTimes(1);
    expect(forceSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(resetSpy).toHaveBeenCalledTimes(1);
    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  it('should expose draft set/clean helpers on grouped source state', () => {
    const readUser = createReadUserSource();
    const unit = readUser(templateSlug);
    const draftSetSpy = vi.spyOn(unit.draft, 'set');
    const draftCleanSpy = vi.spyOn(unit.draft, 'clean');
    const { result } = renderHook(() => useLivonSourceState(unit));

    act(() => {
      result.current.draft.set((value) => value);
      result.current.draft.clean();
    });

    expect(draftSetSpy).toHaveBeenCalledTimes(1);
    expect(draftCleanSpy).toHaveBeenCalledTimes(1);
  });
});
