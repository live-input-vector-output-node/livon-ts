import { createVitestConfig } from '@livon/config/vitest/base';

const base = createVitestConfig({ type: 'unit' });

export default {
  ...base,
  resolve: {
    conditions: ['development', 'default'],
  },
};
