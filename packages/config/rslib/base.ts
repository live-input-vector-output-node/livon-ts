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
