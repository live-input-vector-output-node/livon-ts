import { createRslibMiniConfig } from '@livon/config/rslib/base';

export default createRslibMiniConfig({
  target: 'node',
  formats: ['esm', 'cjs'],
});
