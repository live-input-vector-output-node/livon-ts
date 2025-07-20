export type Enum<T extends string> = {
  [K in T]: K;
}

export type AnyFunction = (...args: any[]) => any;

export type AnyConstructor = new (...args: any[]) => any;

export type TypeOrFunction<TType extends unknown, TArgs extends unknown[] = []> = Promise<TType> | TType | ((...args: TArgs) => Promise<TType> | TType);

export type Unpromised<T> = T extends Promise<infer TUnpromised> ? TUnpromised : T;