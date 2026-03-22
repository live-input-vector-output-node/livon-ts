import type { CreateUnitSnapshotInput, UnitSnapshot } from './types.js';

export const createUnitSnapshot = <RResult>(
  input: CreateUnitSnapshotInput<RResult>,
): UnitSnapshot<RResult> => {
  const { value, status, meta, context } = input;

  return {
    value,
    status,
    meta,
    context,
  };
};
