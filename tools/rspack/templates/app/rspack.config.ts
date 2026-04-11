import { base, browser, compose, devServer, entry, html, react } from '@livon/rspack';

const config = compose(
  base(),
  browser(),
  react(),
  entry('./src/index.tsx'),
  html('./public/index.html'),
  devServer({ port: 3000 }),
);

export default config;
