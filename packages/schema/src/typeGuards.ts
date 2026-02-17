export interface TypeGuard<T> {
  (input: unknown): input is T;
}

/**
 * isString is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/type-guards
 *
 * @example
 * const result = isString(undefined as never);
 */
export const isString = (input: unknown): input is string => typeof input === 'string';

/**
 * isNumber is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/type-guards
 *
 * @example
 * const result = isNumber(undefined as never);
 */
export const isNumber = (input: unknown): input is number =>
  typeof input === 'number' && !Number.isNaN(input);

/**
 * isBoolean is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/type-guards
 *
 * @example
 * const result = isBoolean(undefined as never);
 */
export const isBoolean = (input: unknown): input is boolean => typeof input === 'boolean';

/**
 * isDate is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/type-guards
 *
 * @example
 * const result = isDate(undefined as never);
 */
export const isDate = (input: unknown): input is Date =>
  input instanceof Date && !Number.isNaN(input.getTime());

/**
 * isUint8Array is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/type-guards
 *
 * @example
 * const result = isUint8Array(undefined as never);
 */
export const isUint8Array = (input: unknown): input is Uint8Array => input instanceof Uint8Array;

export interface UnknownRecord {
  [key: string]: unknown;
}

/**
 * isRecord is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/type-guards
 *
 * @example
 * const result = isRecord(undefined as never);
 */
export const isRecord = (input: unknown): input is UnknownRecord =>
  input !== null && typeof input === 'object' && !Array.isArray(input);

export interface ArrayTypeGuard<T> {
  (input: unknown): input is readonly T[];
}

/**
 * isArray is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/type-guards
 *
 * @example
 * const result = isArray(undefined as never);
 */
export const isArray = <T>(): ArrayTypeGuard<T> => (input): input is readonly T[] => Array.isArray(input);
