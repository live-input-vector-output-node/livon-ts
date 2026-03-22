import { createVitestConfig } from '@livon/config/vitest/base.cjs';

const base = createVitestConfig({
  type: 'unit',
});

export default {
  ...base,
  test: {
    ...base.test,
    environment: 'jsdom',
  },
};
