import { createRslibMiniConfig } from '@livon/config/rslib/base';

export default createRslibMiniConfig({
  target: 'web',
  formats: ['esm', 'cjs'],
});
