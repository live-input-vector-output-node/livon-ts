import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import { mergeEslintOptions } from './merge.ts';
import type { EslintBuilder, EslintConfig } from './types.ts';

const defaultBaseOptions: EslintConfig = {
  ignores: ['**/dist/**', '**/build/**', '**/coverage/**', '**/node_modules/**'],
  files: ['**/*.ts', '**/*.tsx'],
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
  plugins: {
    '@typescript-eslint': tsPlugin,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/consistent-type-definitions': ['warn', 'interface'],
    'no-var': 'error',
    'prefer-const': 'error',
    'prefer-object-spread': 'error',
    'max-params': ['warn', 2],
    'func-style': ['warn', 'expression', { allowArrowFunctions: true }],
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ForStatement',
        message: 'Use declarative array methods instead of for-loops.',
      },
      {
        selector: 'ForInStatement',
        message: 'Use Object.entries/keys with declarative methods instead of for..in.',
      },
      {
        selector: 'ForOfStatement',
        message: 'Use declarative array methods instead of for..of.',
      },
      {
        selector: 'WhileStatement',
        message: 'Use recursion or declarative iteration instead of while.',
      },
      {
        selector: 'DoWhileStatement',
        message: 'Use recursion or declarative iteration instead of do..while.',
      },
      {
        selector: 'ClassDeclaration',
        message: 'Use functional modules and data, not classes.',
      },
      {
        selector: 'ClassExpression',
        message: 'Use functional modules and data, not classes.',
      },
      {
        selector: 'ThisExpression',
        message: 'Do not use this; pass explicit inputs through parameters/closures.',
      },
    ],
  },
};

export const base = (options: EslintConfig = {}): EslintBuilder => {
  return () => mergeEslintOptions(defaultBaseOptions, options);
};
