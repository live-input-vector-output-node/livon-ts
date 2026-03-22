import { stableSerializeStructuredValue } from './structuredSerialization.js';

export const stableSerialize = (input: unknown): string => {
  return stableSerializeStructuredValue(input);
};
