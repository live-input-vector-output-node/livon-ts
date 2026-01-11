import { createRslibConfig } from '@livon/config/rslib/base';

export default createRslibConfig({
  target: 'node',
  formats: ['esm', 'cjs'],
});
