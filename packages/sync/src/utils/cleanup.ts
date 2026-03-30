export interface Cleanup {
  (): void;
}

export const invokeCleanup = (
  cleanup: Cleanup | null,
): void => {
  if (!cleanup) {
    return;
  }

  try {
    cleanup();
  } catch {
    return;
  }
};

export const isCleanup = (
  input: unknown,
): input is Cleanup => {
  return typeof input === 'function';
};
