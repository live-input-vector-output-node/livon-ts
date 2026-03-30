import type { EffectListener, UnitSnapshot } from './types.js';

export const notifyEffectListeners = <
  RResult,
  TMeta = unknown,
  TContext = unknown,
  TIdentity = object | undefined,
>(
  listeners: Set<EffectListener<RResult, TMeta, TContext, TIdentity>>,
  snapshot: UnitSnapshot<RResult, TMeta, TContext, TIdentity>,
): void => {
  listeners.forEach((listener) => {
    listener(snapshot);
  });
};
