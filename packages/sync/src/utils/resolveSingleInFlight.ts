import type { SerializedKeyCache } from './serializedKeyCache.js';

interface ResolveSingleInFlightInput<TValue> {
  currentPayload: unknown;
  hasTrackedPayload: boolean;
  payloadKeyCache: SerializedKeyCache;
  promise: Promise<TValue> | null;
  trackedPayload: unknown;
  trackedPayloadKey: string | null;
}

interface ResolveSingleInFlightResult<TValue> {
  currentPayloadKey: string | null;
  promise: Promise<TValue> | null;
  trackedPayloadKey: string | null;
}

export const resolveSingleInFlight = <TValue>({
  currentPayload,
  hasTrackedPayload,
  payloadKeyCache,
  promise,
  trackedPayload,
  trackedPayloadKey,
}: ResolveSingleInFlightInput<TValue>): ResolveSingleInFlightResult<TValue> => {
  if (!promise) {
    return {
      currentPayloadKey: null,
      promise: null,
      trackedPayloadKey,
    };
  }

  if (hasTrackedPayload && Object.is(trackedPayload, currentPayload)) {
    return {
      currentPayloadKey: null,
      promise,
      trackedPayloadKey,
    };
  }

  const currentPayloadKey = payloadKeyCache.getOrCreateKey(currentPayload);
  const nextTrackedPayloadKey = trackedPayloadKey
    ?? (
      hasTrackedPayload
        ? payloadKeyCache.getOrCreateKey(trackedPayload)
        : null
    );

  return {
    currentPayloadKey,
    promise: nextTrackedPayloadKey === currentPayloadKey ? promise : null,
    trackedPayloadKey: nextTrackedPayloadKey,
  };
};
