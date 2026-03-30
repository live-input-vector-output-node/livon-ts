import { type UnitSetAction } from './types.js';

export const DEFAULT_UNIT_DESTROY_DELAY = 250;
export const DEFAULT_RUN_CONTEXT_CACHE_LIMIT = 32;

export const resolveUnitRunAsVoid = (): void => undefined;

export const isUnitSetAction = <
  TPayload,
  TConfig,
  TData,
  TMeta,
  TContext = unknown,
>(
  input: unknown,
): input is UnitSetAction<TPayload, TConfig, TData, TMeta, TContext> => {
  return typeof input === 'function';
};
