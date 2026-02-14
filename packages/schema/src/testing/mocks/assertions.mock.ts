export interface CapturedThrow {
  threw: boolean;
  value?: unknown;
}

export const captureThrow = (fn: () => unknown): CapturedThrow => {
  try {
    fn();
    return { threw: false };
  } catch (error) {
    return { threw: true, value: error };
  }
};
