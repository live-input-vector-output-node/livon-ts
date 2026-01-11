#!/usr/bin/env node
import('../dist/index.js').catch((error) => {
  console.error(error);
  process.exit(1);
});
