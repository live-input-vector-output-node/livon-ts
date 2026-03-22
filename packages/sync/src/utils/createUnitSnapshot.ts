import type { CreateUnitSnapshotInput, UnitSnapshot } from './types.js';

export const createUnitSnapshot = <RResult>(
  { value, status, meta, context }: CreateUnitSnapshotInput<RResult>,
): UnitSnapshot<RResult> => {
  return {
    value,
    status,
    meta,
    context,
  };
};
