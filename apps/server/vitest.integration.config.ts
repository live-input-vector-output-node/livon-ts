import { base, compose, integration } from '@livon/vitest';

const config = compose(base(), integration());

export default {
  ...config,
  resolve: {
    conditions: ['development', 'default'],
  },
};
