import type { EffectListener, UnitSnapshot } from './types.js';

export const notifyEffectListeners = <RResult>(
  listeners: Set<EffectListener<RResult>>,
  snapshot: UnitSnapshot<RResult>,
): void => {
  Array.from(listeners).forEach((listener) => {
    listener(snapshot);
  });
};
