import { describe, expect, it } from 'vitest';

import { CLIENT_GENERATION_REMOVED_MESSAGE, runLivonCli } from './index.js';

describe('runLivonCli()', () => {
  it('fails with the plugin migration message', () => {
    expect(runLivonCli).toThrow(CLIENT_GENERATION_REMOVED_MESSAGE);
  });
});
