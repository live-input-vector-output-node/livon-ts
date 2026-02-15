/**
 * Shared Rslib base config helpers exported by `@livon/config`.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/packages/config
 */
import { defineConfig, type ConfigParams } from '@rslib/core';

type RslibTarget = 'node' | 'web';
type RslibFormat = 'esm' | 'cjs';

interface CreateRslibConfigInput {
  target: RslibTarget;
  formats: ReadonlyArray<RslibFormat>;
}

interface ResolveFormatsInput {
  command: ConfigParams['command'];
  formats: ReadonlyArray<RslibFormat>;
}

const resolveFormats = ({ command, formats }: ResolveFormatsInput): ReadonlyArray<RslibFormat> => {
  if (command !== 'dev') {
    return formats;
  }

  const devFormats = formats.filter((format) => format === 'esm');
  return devFormats.length > 0 ? devFormats : formats;
};

/**
 * Creates a reusable Rslib configuration with deterministic dev format selection.
 *
 * @example
 * ```ts
 * import { createRslibConfig } from '@livon/config/rslib';
 *
 * export default createRslibConfig({
 *   target: 'node',
 *   formats: ['esm', 'cjs'],
 * });
 * ```
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/packages/config
 */
export const createRslibConfig = ({ target, formats }: CreateRslibConfigInput) => {
  return defineConfig(({ command }) => {
    const selectedFormats = resolveFormats({ command, formats });

    return {
      dev: {
        clearScreen: false,
      },
      lib: selectedFormats.map((format) => {
        return {
          format,
          syntax: 'es2021',
          dts: true,
          bundle: false,
        };
      }),
      output: {
        target,
        distPath: 'dist',
        cleanDistPath: false,
      },
    };
  });
};
