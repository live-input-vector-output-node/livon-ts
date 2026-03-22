import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createReadUserSource,
  createTemplateSlug,
} from './testing/utils/index.js';
import { useLivonStatus } from './useLivonStatus.js';
import { useLivonValue } from './useLivonValue.js';

describe('useLivonScopeRefCount()', () => {
  const stopDelay = 250;

  const createReadUserUnit = (slugPrefix?: string) => {
    const readUser = createReadUserSource();
    const slug = slugPrefix
      ? createTemplateSlug({ prefix: slugPrefix })
      : createTemplateSlug();

    return readUser(slug);
  };

  const runStopDelay = (delay: number) => {
    act(() => {
      vi.advanceTimersByTime(delay);
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should not stop a unit when another listener is still mounted for the same scope', () => {
    const unit = createReadUserUnit();
    const stopSpy = vi.spyOn(unit, 'stop');
    const first = renderHook(() => useLivonValue(unit));
    const second = renderHook(() => useLivonValue(unit));

    first.unmount();

    expect(stopSpy).not.toHaveBeenCalled();

    second.unmount();
    runStopDelay(stopDelay);

    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  it('should share listener count when value and status listen to the same unit', () => {
    const unit = createReadUserUnit();
    const stopSpy = vi.spyOn(unit, 'stop');
    const valueHook = renderHook(() => useLivonValue(unit));
    const statusHook = renderHook(() => useLivonStatus(unit));

    valueHook.unmount();

    expect(stopSpy).not.toHaveBeenCalled();

    statusHook.unmount();
    runStopDelay(stopDelay);

    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  it('should stop each unit independently when scopes are different', () => {
    const firstUnit = createReadUserUnit('template-id-first');
    const secondUnit = createReadUserUnit('template-id-second');
    const firstStopSpy = vi.spyOn(firstUnit, 'stop');
    const secondStopSpy = vi.spyOn(secondUnit, 'stop');
    const firstHook = renderHook(() => useLivonValue(firstUnit));
    const secondHook = renderHook(() => useLivonValue(secondUnit));

    firstHook.unmount();
    runStopDelay(stopDelay);

    expect(firstStopSpy).toHaveBeenCalledTimes(1);
    expect(secondStopSpy).not.toHaveBeenCalled();

    secondHook.unmount();
    runStopDelay(stopDelay);

    expect(secondStopSpy).toHaveBeenCalledTimes(1);
  });

  it('should count listeners by mount lifecycle when rerenders happen on the same hook instance', () => {
    const unit = createReadUserUnit();
    const stopSpy = vi.spyOn(unit, 'stop');
    const hook = renderHook(() => useLivonValue(unit));

    hook.rerender();
    hook.rerender();
    hook.rerender();
    hook.unmount();
    runStopDelay(stopDelay);

    expect(stopSpy).toHaveBeenCalledTimes(1);
  });

  it('should cancel pending stop when the same unit is mounted again before debounce ends', () => {
    const unit = createReadUserUnit();
    const stopSpy = vi.spyOn(unit, 'stop');
    const firstHook = renderHook(() => useLivonValue(unit));

    firstHook.unmount();
    runStopDelay(stopDelay - 1);

    const secondHook = renderHook(() => useLivonValue(unit));

    runStopDelay(1);

    expect(stopSpy).not.toHaveBeenCalled();

    secondHook.unmount();
    runStopDelay(stopDelay);
  });

  it('should stop once when rapid mount and unmount churn ends without active listeners', () => {
    const unit = createReadUserUnit();
    const stopSpy = vi.spyOn(unit, 'stop');

    const firstHook = renderHook(() => useLivonValue(unit));
    firstHook.unmount();
    runStopDelay(stopDelay - 1);

    const secondHook = renderHook(() => useLivonValue(unit));
    secondHook.unmount();
    runStopDelay(stopDelay - 1);

    const thirdHook = renderHook(() => useLivonValue(unit));
    thirdHook.unmount();
    runStopDelay(stopDelay);

    expect(stopSpy).toHaveBeenCalledTimes(1);
  });
});
