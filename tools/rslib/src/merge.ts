import { mergeRslibConfig, type RslibConfig } from '@rslib/core';

export const mergeRslibOptions = (left: RslibConfig, right: RslibConfig): RslibConfig => {
  const merged = mergeRslibConfig(left, right);
  return {
    ...merged,
    lib: merged.lib ?? [],
  };
};
