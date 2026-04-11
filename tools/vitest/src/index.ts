import { base } from './base.ts';
import { compose } from './compose.ts';
import { integration } from './integration.ts';
import type { CreateVitestConfigInput } from './types.ts';
import { unit } from './unit.ts';

export { compose } from './compose.ts';
export { base } from './base.ts';
export { unit } from './unit.ts';
export { integration } from './integration.ts';
export type { CreateVitestConfigInput, VitestBuilder, VitestConfig, VitestPresetType } from './types.ts';

export const createVitestConfig = ({ type }: CreateVitestConfigInput) => {
  return compose(base(), type === 'unit' ? unit() : integration());
};
