import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  createRandomUser,
  createReadUserSource,
  createTemplateSlug,
} from './testing/utils/index.js';
import { useLivonStatus } from './useLivonStatus.js';

describe('useLivonStatus()', () => {
  let templateSlug: ReturnType<typeof createTemplateSlug>;

  beforeEach(() => {
    templateSlug = createTemplateSlug();
  });

  it('should return idle when run has not been called', () => {
    const readUser = createReadUserSource();
    const unit = readUser(templateSlug);

    const { result } = renderHook(() => useLivonStatus(unit));

    expect(result.current).toBe('idle');
  });

  it('should return success when run resolves', async () => {
    const readUser = createReadUserSource({
      run: async ({ upsertOne }) => {
        await Promise.resolve();
        upsertOne(createRandomUser({
          idPrefix: 'resolved-id',
          namePrefix: 'resolved-name',
        }));
      },
    });

    const unit = readUser(templateSlug);
    const { result } = renderHook(() => useLivonStatus(unit));

    await act(async () => {
      await unit.run();
    });

    expect(result.current).toBe('success');
  });

  it('should keep same status value when rerender does not change snapshot status', () => {
    const readUser = createReadUserSource();
    const unit = readUser(templateSlug);
    const { result, rerender } = renderHook(() => useLivonStatus(unit));
    const firstStatus = result.current;

    rerender();

    expect(result.current).toBe(firstStatus);
  });
});
