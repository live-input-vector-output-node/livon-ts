import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createReadUserSource, createTemplateSlug } from './testing/utils/index.js';
import { useLivonDraft } from './useLivonDraft.js';

describe('useLivonDraft()', () => {
  let templateScope: ReturnType<typeof createTemplateSlug>;

  beforeEach(() => {
    templateScope = createTemplateSlug();
  });

  const createReadUserUnit = () => {
    const readUser = createReadUserSource();
    return readUser(templateScope);
  };

  it('should call unit setDraft when draft setter is executed', () => {
    const unit = createReadUserUnit();
    const setDraftSpy = vi.spyOn(unit, 'setDraft');
    const { result } = renderHook(() => useLivonDraft(unit));

    act(() => {
      const [setDraft] = result.current;
      setDraft((value) => value);
    });

    expect(setDraftSpy).toHaveBeenCalledTimes(1);
  });

  it('should call unit cleanDraft when draft cleaner is executed', () => {
    const unit = createReadUserUnit();
    const cleanDraftSpy = vi.spyOn(unit, 'cleanDraft');
    const { result } = renderHook(() => useLivonDraft(unit));

    act(() => {
      const [, cleanDraft] = result.current;
      cleanDraft();
    });

    expect(cleanDraftSpy).toHaveBeenCalledTimes(1);
  });

  it('should keep draft setter instance stable when hook rerenders with same unit', () => {
    const unit = createReadUserUnit();
    const { result, rerender } = renderHook(() => useLivonDraft(unit));
    const [firstSetDraft] = result.current;

    rerender();

    const [nextSetDraft] = result.current;
    expect(nextSetDraft).toBe(firstSetDraft);
  });

  it('should keep draft cleaner instance stable when hook rerenders with same unit', () => {
    const unit = createReadUserUnit();
    const { result, rerender } = renderHook(() => useLivonDraft(unit));
    const [, firstCleanDraft] = result.current;

    rerender();

    const [, nextCleanDraft] = result.current;
    expect(nextCleanDraft).toBe(firstCleanDraft);
  });
});
