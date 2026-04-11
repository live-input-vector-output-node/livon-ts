import { base, compose, unit } from '@livon/vitest';

const config = compose(base(), unit());

export default {
  ...config,
  resolve: {
    conditions: ['development', 'default'],
  },
};
