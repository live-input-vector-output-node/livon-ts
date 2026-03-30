import {
  type Entity,
  type EntityDraftCommitInput,
  type EntityDraftIdentityInput,
  type EntityDraftOptions,
  type EntityId,
} from '../entity.js';
import type { DraftState } from './types.js';

interface CreateDraftAwareEntityInput<TEntity extends object> {
  entity: Entity<TEntity, EntityId>;
}

interface DraftIdentityMethods<TEntity extends object> {
  getDraftById: (id: EntityId) => TEntity | undefined;
  getDraftStateById: (id: EntityId) => DraftState;
  getDraftIdsByIdentity: (
    identityKey: string,
    options?: EntityDraftOptions,
  ) => readonly EntityId[];
  hasDraftByIdentity: (identityKey: string, options?: EntityDraftOptions) => boolean;
  setDraft: (input: TEntity, identity: EntityDraftIdentityInput) => TEntity;
  setDraftMany: (
    input: readonly TEntity[],
    identity: EntityDraftIdentityInput,
  ) => readonly TEntity[];
  clearDraft: (id: EntityId, identity: EntityDraftIdentityInput) => boolean;
  clearDraftMany: (ids: readonly EntityId[], identity: EntityDraftIdentityInput) => readonly EntityId[];
  clearDraftByIdentity: (
    identityKey: string,
    options?: EntityDraftOptions,
  ) => readonly EntityId[];
  commitDraft: (id: EntityId, identity: EntityDraftCommitInput) => TEntity | undefined;
  commitDraftMany: (
    ids: readonly EntityId[],
    identity: EntityDraftCommitInput,
  ) => readonly TEntity[];
}

interface DraftAwareEntityResult<TEntity extends object> {
  entity: Entity<TEntity, EntityId>;
  methods: DraftIdentityMethods<TEntity>;
}

export const createDraftAwareEntity = <TEntity extends object>({
  entity,
}: CreateDraftAwareEntityInput<TEntity>): DraftAwareEntityResult<TEntity> => {
  const methods: DraftIdentityMethods<TEntity> = {
    getDraftById: (id) => entity.getDraftById(id),
    getDraftStateById: (id) => entity.getDraftStateById(id),
    getDraftIdsByIdentity: (identityKey, options) => entity.getDraftIdsByIdentity(identityKey, options),
    hasDraftByIdentity: (identityKey, options) => entity.hasDraftByIdentity(identityKey, options),
    setDraft: (input, identity) => entity.setDraft(input, identity),
    setDraftMany: (input, identity) => entity.setDraftMany(input, identity),
    clearDraft: (id, identity) => entity.clearDraft(id, identity),
    clearDraftMany: (ids, identity) => entity.clearDraftMany(ids, identity),
    clearDraftByIdentity: (identityKey, options) => entity.clearDraftByIdentity(identityKey, options),
    commitDraft: (id, identity) => entity.commitDraft(id, identity),
    commitDraftMany: (ids, identity) => entity.commitDraftMany(ids, identity),
  };

  return {
    entity,
    methods,
  };
};
