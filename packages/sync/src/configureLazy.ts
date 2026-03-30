export interface LazyConfig {
  warmupOnFirstRun?: boolean;
}

interface LazyConfigState {
  warmupOnFirstRun: boolean;
}

const lazyConfigState: LazyConfigState = {
  warmupOnFirstRun: false,
};

export const configureLazy = ({
  warmupOnFirstRun = false,
}: LazyConfig = {}): void => {
  lazyConfigState.warmupOnFirstRun = warmupOnFirstRun;
};

export const shouldWarmupOnFirstRun = (): boolean => {
  return lazyConfigState.warmupOnFirstRun;
};
