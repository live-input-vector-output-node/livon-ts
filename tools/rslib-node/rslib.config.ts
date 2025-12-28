import { defineConfig, type ConfigParams } from '@rslib/core';

type RslibFormat = 'esm' | 'cjs';

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

export default defineConfig(({ command }) => {
  const formats = resolveFormats({ command, formats: ['esm', 'cjs'] });

  return {
    dev: {
      clearScreen: false,
    },
    lib: formats.map((format) => {
      return {
        format,
        syntax: 'es2021',
        dts: true,
        bundle: false,
      };
    }),
    output: {
      target: 'node',
      distPath: 'dist',
      cleanDistPath: false,
    },
  };
});
