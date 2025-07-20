export interface NamedAliasOptions {
  name: string;
  optional?: true;
}
export interface ModuleAliasOptions extends NamedAliasOptions {
  module: string;
  as?: string;
}

export interface PropertyAliasOptions extends ModuleAliasOptions {
  property: true;
}

export interface MethodAliasOptions extends NamedAliasOptions {
  parameters?: string[];
  returns: string;
}

export interface ObjectAliasOptions extends NamedAliasOptions {
  properties: Record<string | number, Alias>;
}

export interface UnionAliasOptions {
  union: Alias[];
}

export interface ArrayAliasOptions {
  array: Alias;
}

export interface AndAliasOptions {
  and: Alias[];
}

export interface TupleAliasOptions {
  tuple: Alias[];
}

export interface AdditionalPropertieAliasOptions {
  additionalProperties: Alias;
}

export interface EnumAliasOptions extends NamedAliasOptions {
  enum: string[];
}

export interface OptionalAliasOptions {
  optional: true;
}

export type AliasOptions =
  | NamedAliasOptions
  | ModuleAliasOptions
  | PropertyAliasOptions
  | MethodAliasOptions
  | ObjectAliasOptions
  | UnionAliasOptions
  | ArrayAliasOptions
  | AndAliasOptions
  | TupleAliasOptions
  | AdditionalPropertieAliasOptions
  | OptionalAliasOptions;

export type Alias<T extends AliasOptions = AliasOptions> = T & {
  isNamed(): this is NamedAliasOptions;
  isModule(): this is ModuleAliasOptions;
  isProperty(): this is PropertyAliasOptions;
  isMethod(): this is MethodAliasOptions;
  isObject(): this is ObjectAliasOptions;
  isAnd(): this is AndAliasOptions;
  isUnion(): this is UnionAliasOptions;
  isArray(): this is ArrayAliasOptions;
  isTuple(): this is TupleAliasOptions;
  isAdditionalProperties(): this is AdditionalPropertieAliasOptions;
  isOptional(): this is OptionalAliasOptions;
}

const cache = new Map<string, Alias>();

export const createAlias = (options: AliasOptions): Alias<typeof options> => {
  if(!options || typeof options !== 'object') {
    throw new Error("Invalid alias options provided");
  }

  let cachedAlias = cache.get(JSON.stringify(options));

  if(cachedAlias) {
    return cachedAlias as Alias<typeof options>;
  }

  return {
    ...options,
    isNamed(): this is NamedAliasOptions { return 'name' in this },
    isModule(): this is ModuleAliasOptions { return 'module' in this && 'name' in this },
    isProperty(): this is PropertyAliasOptions { return 'property' in this && 'module' in this && 'name' in this },
    isMethod(): this is MethodAliasOptions { return 'returns' in this && 'name' in this },
    isObject(): this is ObjectAliasOptions { return 'properties' in this && 'name' in this },
    isAnd(): this is AndAliasOptions { return 'and' in this && Array.isArray(this.and) },
    isUnion(): this is UnionAliasOptions { return 'union' in this && Array.isArray(this.union) },
    isArray(): this is ArrayAliasOptions { return 'array' in this && Array.isArray(this.array) },
    isTuple(): this is TupleAliasOptions { return 'tuple' in this && Array.isArray(this.tuple) },
    isAdditionalProperties(): this is AdditionalPropertieAliasOptions { return 'additionalProperties' in this && 'name' in this },
    isOptional(): this is OptionalAliasOptions { return 'optional' in this && this.optional === true; },
  };
}