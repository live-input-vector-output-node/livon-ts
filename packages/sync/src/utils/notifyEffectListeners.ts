import type { EffectListener, UnitSnapshot } from './types.js';

export const notifyEffectListeners = <
  RResult,
  TMeta = unknown,
>(
  listeners: Set<EffectListener<RResult, TMeta>>,
  snapshot: UnitSnapshot<RResult, TMeta>,
): void => {
  Array.from(listeners).forEach((listener) => {
    listener(snapshot);
  });
};
