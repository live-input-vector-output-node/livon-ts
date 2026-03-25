import type { CreateUnitSnapshotInput, UnitSnapshot } from './types.js';

export const createUnitSnapshot = <
  RResult,
  TMeta = unknown,
>(
  { value, status, meta, context }: CreateUnitSnapshotInput<RResult, TMeta>,
): UnitSnapshot<RResult, TMeta> => {
  return {
    value,
    status,
    meta,
    context,
  };
};
