const listenerCountByUnit = new WeakMap<object, number>();

export const addTrackedUnitListener = (
  unit: object,
): number => {
  const current = listenerCountByUnit.get(unit) ?? 0;
  const next = current + 1;

  listenerCountByUnit.set(unit, next);

  return next;
};

export const removeTrackedUnitListener = (
  unit: object,
): number => {
  const current = listenerCountByUnit.get(unit);

  if (!current || current <= 1) {
    listenerCountByUnit.delete(unit);
    return 0;
  }

  const next = current - 1;
  listenerCountByUnit.set(unit, next);

  return next;
};

export const clearTrackedUnitListeners = (
  unit: object,
): void => {
  listenerCountByUnit.delete(unit);
};
