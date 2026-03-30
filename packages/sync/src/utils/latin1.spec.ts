import { describe, expect, it } from 'vitest';

import { decodeLatin1, encodeLatin1 } from './latin1.js';

describe('latin1', () => {
  it('should round-trip full byte range', () => {
    const input = Uint8Array.from(Array.from({ length: 256 }, (_unused, index) => index));

    const encoded = encodeLatin1(input);
    const decoded = decodeLatin1(encoded);

    expect(Array.from(decoded.values())).toEqual(Array.from(input.values()));
  });

  it('should produce deterministic output for same input', () => {
    const input = Uint8Array.from([0, 1, 2, 3, 254, 255]);

    const first = encodeLatin1(input);
    const second = encodeLatin1(input);

    expect(first).toBe(second);
  });
});
