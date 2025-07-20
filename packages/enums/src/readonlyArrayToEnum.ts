import { Enum } from "./types.js";

export const readOnlyArrayToEnum = <T extends string>(arr: readonly T[]): Enum<T> =>
  Object.fromEntries(arr.map(item => [item, item])) as Enum<T>;