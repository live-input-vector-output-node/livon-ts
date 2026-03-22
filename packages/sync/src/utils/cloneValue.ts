interface StructuredCloneFunction {
  <TInput>(value: TInput): TInput;
}

interface GlobalWithStructuredClone {
  structuredClone?: StructuredCloneFunction;
}

const isObjectLike = <TInput>(value: TInput): boolean => {
  return typeof value === 'object' && value !== null;
};

const getStructuredClone = (): StructuredCloneFunction | undefined => {
  const maybeClone = (globalThis as GlobalWithStructuredClone).structuredClone;

  if (typeof maybeClone === 'function') {
    return maybeClone as StructuredCloneFunction;
  }

  return undefined;
};

const cloneWithJson = <TInput>(value: TInput): TInput => {
  if (!isObjectLike(value)) {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as TInput;
};

export const cloneValue = <TInput>(value: TInput): TInput => {
  if (!isObjectLike(value)) {
    return value;
  }

  const structuredClone = getStructuredClone();
  if (structuredClone) {
    return structuredClone(value);
  }

  return cloneWithJson(value);
};
