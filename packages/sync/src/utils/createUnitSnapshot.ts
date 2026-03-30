import type { CreateUnitSnapshotInput, UnitSnapshot } from './types.js';

export const createUnitSnapshot = <
  RResult,
  TMeta = unknown,
  TContext = unknown,
  TIdentity = object | undefined,
>(
  { identity, value, status, meta, context }: CreateUnitSnapshotInput<
    RResult,
    TMeta,
    TContext,
    TIdentity
  >,
): UnitSnapshot<RResult, TMeta, TContext, TIdentity> => {
  return {
    identity,
    value,
    status,
    meta,
    context,
  };
};
