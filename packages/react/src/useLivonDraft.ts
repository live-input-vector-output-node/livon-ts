import { type SourceUnit } from '@livon/sync';
import { useCallback } from 'react';

import type { LivonDraftOf } from './types.js';

export interface UseLivonDraft {
  <
  TInput extends object | undefined,
  TPayload,
  RResult,
  UUpdate extends RResult,
>(unit: SourceUnit<TInput, TPayload, RResult, UUpdate>): LivonDraftOf<
    SourceUnit<TInput, TPayload, RResult, UUpdate>
  >;
}

const useLivonDraftInternal = <
  TInput extends object | undefined,
  TPayload,
  RResult,
  UUpdate extends RResult,
>(
  unit: SourceUnit<TInput, TPayload, RResult, UUpdate>,
): LivonDraftOf<SourceUnit<TInput, TPayload, RResult, UUpdate>> => {
  const setDraft = useCallback((input: Parameters<typeof unit.setDraft>[0]) => {
    unit.setDraft(input);
  }, [unit]);

  const cleanDraft = useCallback(() => {
    unit.cleanDraft();
  }, [unit]);

  return [setDraft, cleanDraft];
};

export const useLivonDraft: UseLivonDraft = useLivonDraftInternal;
