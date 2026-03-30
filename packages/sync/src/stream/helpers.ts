import {
  type StreamCleanup,
  type StreamRunResult,
} from './types.js';

export const isStreamCleanup = (
  input: StreamRunResult,
): input is StreamCleanup => {
  return typeof input === 'function';
};
