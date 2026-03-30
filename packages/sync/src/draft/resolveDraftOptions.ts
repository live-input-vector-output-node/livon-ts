import {
  type Entity,
  type EntityDraftOptions,
  type EntityId,
} from '../entity.js';
import {
  createFunctionKeyResolver,
  isNonEmptyString,
  resolveEntityFunctionIdentityKey,
  resolveEntityFunctionKey,
  resolveUnitMode,
  serializeKey,
  type UnitEntityMode,
} from '../utils/index.js';
import type {
  DraftConfig,
  DraftMode,
} from './types.js';

interface ResolveDraftOptionsInput<
  TIdentity extends object | undefined,
  TEntity extends object,
  TMode extends UnitEntityMode,
  TMeta,
> {
  entity: Entity<TEntity, EntityId>;
  entityMode: TMode;
  config: DraftConfig<TIdentity, TEntity, TMode, TMeta>;
  draftMode: DraftMode;
  identityKey: string;
}

const resolveDraftFunctionKey = createFunctionKeyResolver({
  prefix: 'draft-fallback',
});

const resolveDraftLocalIdentityKey = <
  TIdentity extends object | undefined,
  TEntity extends object,
  TMode extends UnitEntityMode,
  TMeta,
>({
  entity,
  entityMode,
  config,
  identityKey,
}: Omit<ResolveDraftOptionsInput<TIdentity, TEntity, TMode, TMeta>, 'draftMode'>): string => {
  const normalizedEntityKey = isNonEmptyString(entity.key)
    ? entity.key
    : '';
  const resolvedDraftKey = resolveDraftFunctionKey(config.key);
  const { mode: resolvedDraftMode } = resolveUnitMode({
    entityMode,
    defaultValue: config.defaultValue,
  });
  const draftEntityFunctionKey = resolveEntityFunctionKey({
    entityKey: normalizedEntityKey,
    functionKey: serializeKey({
      sourceKey: resolvedDraftKey,
      entityMode: resolvedDraftMode,
    }),
  });

  return resolveEntityFunctionIdentityKey({
    entityFunctionKey: draftEntityFunctionKey,
    identityKey,
  });
};

export const resolveDraftOptions = <
  TIdentity extends object | undefined,
  TEntity extends object,
  TMode extends UnitEntityMode,
  TMeta,
>({
  entity,
  entityMode,
  config,
  draftMode,
  identityKey,
}: ResolveDraftOptionsInput<TIdentity, TEntity, TMode, TMeta>): EntityDraftOptions => {
  if (draftMode !== 'local') {
    return {
      mode: draftMode,
    };
  }

  return {
    mode: 'local',
    localIdentityKey: resolveDraftLocalIdentityKey({
      entity,
      entityMode,
      config,
      identityKey,
    }),
  };
};
