import { base, compose, entry, html, react } from '@livon/rsbuild';
import { livonClientSyncPlugin } from '@livon/plugin-rsbuild';

export default compose(
  base(),
  entry('./src/index.tsx'),
  html('./src/index.html'),
  react(),
  () => ({
    plugins: [
      livonClientSyncPlugin({
        url: 'ws://127.0.0.1:3002/ws',
        outputDirectory: '.livon/generated',
        importIdentifier: '@livon/generated',
        syncMode: 'startup',
        failureMode: 'warnAndUseCache',
      }),
    ],
  }),
  () => ({
    server: {
      port: 3001,
      host: '0.0.0.0',
    },
  }),
);
