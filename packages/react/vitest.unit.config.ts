import { base, compose, unit } from '@livon/vitest';

const config = compose(base(), unit());

export default {
  ...config,
  test: {
    ...(typeof config.test === 'object' && config.test !== null ? config.test : {}),
    environment: 'jsdom',
  },
};
