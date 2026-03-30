import {
  type UnitDataByEntityMode,
  type UnitEntityMode,
} from './unitDataTypes.js';

export interface CreateFunctionKeyResolverInput {
  prefix: string;
}

export interface ResolveUnitModeInput {
  entityMode: UnitEntityMode | undefined;
  defaultValue: unknown;
}

export interface ResolvedUnitMode {
  mode: UnitEntityMode;
  modeLocked: boolean;
}

export interface ResolveDefaultUnitValueInput {
  defaultValue: unknown;
  mode: UnitEntityMode;
}

export interface ResolveTypedDefaultUnitValueInput<
  TEntity extends object,
  TMode extends UnitEntityMode,
> {
  defaultValue: UnitDataByEntityMode<TEntity, TMode> | undefined;
  mode: TMode;
}

export interface ResolveFunctionKey {
  (key: string | undefined): string;
}

export interface ResolveDefaultUnitValue {
  <
    TEntity extends object,
    TMode extends UnitEntityMode,
  >(
    input: ResolveTypedDefaultUnitValueInput<TEntity, TMode>,
  ): UnitDataByEntityMode<TEntity, TMode>;
  (input: ResolveDefaultUnitValueInput): unknown;
}

export const isNonEmptyString = (input: unknown): input is string => {
  return typeof input === 'string' && input.trim().length > 0;
};

export const createFunctionKeyResolver = ({
  prefix,
}: CreateFunctionKeyResolverInput): ResolveFunctionKey => {
  let nextId = 0;

  return (key) => {
    if (isNonEmptyString(key)) {
      return key;
    }

    nextId += 1;
    return `${prefix}:${nextId}`;
  };
};

export const resolveUnitMode = ({
  entityMode,
  defaultValue,
}: ResolveUnitModeInput): ResolvedUnitMode => {
  const hasExplicitMode = entityMode === 'one' || entityMode === 'many';
  if (hasExplicitMode) {
    return {
      mode: entityMode,
      modeLocked: true,
    };
  }

  return {
    mode: Array.isArray(defaultValue ?? null) ? 'many' : 'one',
    modeLocked: false,
  };
};

export const resolveDefaultUnitValue: ResolveDefaultUnitValue = ({
  defaultValue,
  mode,
}: ResolveDefaultUnitValueInput): unknown => {
  if (defaultValue !== undefined) {
    return defaultValue;
  }

  return mode === 'many' ? [] : null;
};
