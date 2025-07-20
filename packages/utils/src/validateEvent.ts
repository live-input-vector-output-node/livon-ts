import { RefloContext } from '@livo/types/context.ts';
const validateEvent = (event: unknown): RefloContext => {
  if (typeof event !== 'object' || event === null) {
    throw new TypeError('Event must be a non-null object');
  }

  if (!('type' in event) || typeof event.type !== 'string') {
    throw new TypeError('Event must have a "type" property of type string');
  }

  if (!('data' in event) || !['string', 'number', 'object'].includes(typeof event.data) || event.data === null) {
    throw new TypeError('Event must have a "data" property of type object');
  }

  return event as RefloContext;

}