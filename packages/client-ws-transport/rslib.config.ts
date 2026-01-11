import { createRslibConfig } from '@livon/config/rslib/base';

export default createRslibConfig({
  target: 'web',
  formats: ['esm', 'cjs'],
});
