import { base, browser, compose, entry, library } from '@livon/rslib';

export default compose(
  base(),
  library(),
  browser(),
  entry({
    entries: {
      index: './src/index.ts',
      client: './src/client.ts',
      generate: './src/generate.ts',
      typeScriptSurfaceTemplate: './src/typeScriptSurfaceTemplate.ts',
    },
  }),
);
