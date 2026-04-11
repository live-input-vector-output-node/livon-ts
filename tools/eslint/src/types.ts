import type { FlatConfig } from '@typescript-eslint/utils/ts-eslint';

export type EslintConfig = FlatConfig.Config;
export type EslintBuilder = () => EslintConfig;
