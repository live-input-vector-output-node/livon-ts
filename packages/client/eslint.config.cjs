const base = require('@livon/config/eslint/base.cjs');

module.exports = [
  ...base,
  {
    ignores: ['templates/**/*.template.ts'],
  },
];
