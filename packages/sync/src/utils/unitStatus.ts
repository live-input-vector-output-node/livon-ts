import type { UnitStatus } from './types.js';

export const isUnitStatus = (value: unknown): value is UnitStatus => {
  if (typeof value !== 'string') {
    return false;
  }

  return value === 'idle'
    || value === 'rehydrated'
    || value === 'loading'
    || value === 'refreshing'
    || value === 'success'
    || value === 'error';
};

export const isUnitLoadingStatus = (status: UnitStatus): boolean => {
  return status === 'loading' || status === 'refreshing';
};

export const isUnitSettledStatus = (status: UnitStatus): boolean => {
  return status === 'rehydrated' || status === 'success' || status === 'error';
};
