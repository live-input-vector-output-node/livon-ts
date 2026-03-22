import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { randomString } from './testing/randomData.js';
import {
  createRandomUser,
  createReadUserSource,
  createTemplateSlug,
  type MessageMeta,
} from './testing/utils/index.js';
import { useLivonMeta } from './useLivonMeta.js';

describe('useLivonMeta()', () => {
  let templateSlug: ReturnType<typeof createTemplateSlug>;

  const createNextMeta = (): MessageMeta => {
    return {
      severity: randomString({ prefix: 'severity' }),
      text: randomString({ prefix: 'text' }),
    };
  };

  const createSourceWithMeta = (nextMeta: MessageMeta) => {
    return createReadUserSource({
      run: async ({ setMeta, upsertOne }) => {
        setMeta(nextMeta);
        upsertOne(createRandomUser());
      },
    });
  };

  beforeEach(() => {
    templateSlug = createTemplateSlug();
  });

  it('should return null when no meta was set yet', () => {
    const readUser = createReadUserSource({
      run: async () => undefined,
    });

    const unit = readUser(templateSlug);
    const { result } = renderHook(() => useLivonMeta(unit));

    expect(result.current).toBeNull();
  });

  it('should return latest meta when run sets meta', async () => {
    const nextMeta = createNextMeta();
    const readUser = createSourceWithMeta(nextMeta);

    const unit = readUser(templateSlug);
    const { result } = renderHook(() => useLivonMeta(unit));

    await act(async () => {
      await unit.run();
    });

    expect(result.current).toEqual(nextMeta);
  });

  it('should keep same meta instance when rerender does not change snapshot meta', async () => {
    const nextMeta = createNextMeta();
    const readUser = createSourceWithMeta(nextMeta);

    const unit = readUser(templateSlug);
    const { result, rerender } = renderHook(() => useLivonMeta(unit));

    await act(async () => {
      await unit.run();
    });

    const firstMeta = result.current;

    rerender();

    expect(result.current).toBe(firstMeta);
  });
});
