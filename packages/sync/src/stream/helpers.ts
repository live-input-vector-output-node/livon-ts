import {
  type StreamCleanup,
  type StreamRunResult,
} from './types.js';

export const isStreamCleanup = <RResult>(
  input: StreamRunResult<RResult>,
): input is StreamCleanup => {
  return typeof input === 'function';
};
