import type { ViteUserConfig } from 'vitest/config';

export type VitestConfig = ViteUserConfig;
export type VitestBuilder = () => VitestConfig;

export type VitestPresetType = 'unit' | 'integration';

export interface CreateVitestConfigInput {
  type: VitestPresetType;
}
