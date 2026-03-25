import { type SourceUnit } from '@livon/sync';
import { useCallback } from 'react';

import type { LivonDraftOf } from './types.js';

export interface UseLivonDraft {
  <
  TInput extends object | undefined,
  TPayload,
  RResult,
>(unit: SourceUnit<TInput, TPayload, RResult>): LivonDraftOf<
    SourceUnit<TInput, TPayload, RResult>
  >;
}

const useLivonDraftInternal = <
  TInput extends object | undefined,
  TPayload,
  RResult,
>(
  unit: SourceUnit<TInput, TPayload, RResult>,
): LivonDraftOf<SourceUnit<TInput, TPayload, RResult>> => {
  const setDraft = useCallback((input: Parameters<typeof unit.draft.set>[0]) => {
    unit.draft.set(input);
  }, [unit]);

  const cleanDraft = useCallback(() => {
    unit.draft.clean();
  }, [unit]);

  return [setDraft, cleanDraft];
};

export const useLivonDraft: UseLivonDraft = useLivonDraftInternal;
