import { base, compose, entry, html, react } from '@livon/rsbuild';

export default compose(
  base(),
  entry('./src/index.tsx'),
  html('./src/index.html'),
  react(),
  () => ({
    server: {
      port: 3001,
      host: '0.0.0.0',
    },
  }),
);
