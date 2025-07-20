export type Enum<T extends string> = {
  [K in T]: K;
}