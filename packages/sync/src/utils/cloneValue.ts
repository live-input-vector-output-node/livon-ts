import {
  deserializeStructuredValue,
  serializeStructuredValue,
} from './structuredSerialization.js';

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

const structuredCloneFunction = getStructuredClone();

const cloneWithJson = <TInput>(value: TInput): TInput => {
  if (!isObjectLike(value)) {
    return value;
  }

  return deserializeStructuredValue<TInput>(serializeStructuredValue({ input: value }));
};

export const cloneValue = <TInput>(value: TInput): TInput => {
  if (!isObjectLike(value)) {
    return value;
  }

  if (structuredCloneFunction) {
    return structuredCloneFunction(value);
  }

  return cloneWithJson(value);
};
