import type {
  EntityReadWriteConfig,
  EntityReadWriteInput,
} from '../utils/readWriteStrategy.js';

export interface UpsertOptions {
  merge?: boolean;
}

export type EntityId = string | number | symbol;
export type CacheTtl = number | 'infinity';

export interface CacheConfig {
  key?: string;
  ttl?: CacheTtl;
  lruMaxEntries?: number;
}

export interface RegisterEntityUnitInput {
  key: string;
  onChange: () => void;
}

export interface SetEntityUnitMembershipInput<TId extends EntityId> {
  key: string;
  ids: readonly TId[];
}

export interface EntityDraftState {
  dirty: boolean;
  ownerIdentityKey: string | null;
  hasQueuedChanges: boolean;
  mode: EntityDraftMode | null;
  localIdentityKey: string | null;
}

export type EntityDraftMode = 'local' | 'identity' | 'global';

export interface EntityDraftOptions {
  mode?: EntityDraftMode;
  localIdentityKey?: string;
}

export interface EntityReadByIdentityContextInput<TId extends EntityId> {
  id: TId;
  identityKey: string;
  localIdentityKey: string;
}

export interface EntityDraftIdentityInput {
  identityKey: string;
  options?: EntityDraftOptions;
}

export interface EntityDraftCommitInput {
  identityKey: string;
  options?: UpsertOptions;
}

export interface EntityConfig<
  TInput extends object,
  TId extends EntityId = string,
> {
  key: string;
  idOf: (input: TInput) => TId;
  ttl?: number;
  destroyDelay?: number;
  cache?: CacheConfig;
  readWrite?: EntityReadWriteInput;
}

export type EntityByIdMap<TInput extends object, TId extends EntityId> = Map<TId, TInput>;

export interface Entity<
  TInput extends object = object,
  TId extends EntityId = string,
> {
  key: string;
  ttl?: number;
  destroyDelay?: number;
  cache?: CacheConfig;
  readWrite: EntityReadWriteConfig;
  idOf(input: TInput): TId;
  entitiesById: EntityByIdMap<TInput, TId>;
  getById(id: TId): TInput | undefined;
  getByIdForIdentity(id: TId, identityKey: string): TInput | undefined;
  getByIdForIdentityContext(input: EntityReadByIdentityContextInput<TId>): TInput | undefined;
  registerUnit(input: RegisterEntityUnitInput): () => void;
  setUnitMembership(input: SetEntityUnitMembershipInput<TId>): void;
  clearUnitMembership(key: string): void;
  upsertOne(input: TInput, options?: UpsertOptions): TInput;
  upsertMany(input: readonly TInput[], options?: UpsertOptions): readonly TInput[];
  deleteOne(id: TId): boolean;
  deleteMany(ids: readonly TId[]): readonly TId[];
  getDraftById(id: TId): TInput | undefined;
  getDraftStateById(id: TId): EntityDraftState;
  getDraftIdsByIdentity(identityKey: string, options?: EntityDraftOptions): readonly TId[];
  hasDraftByIdentity(identityKey: string, options?: EntityDraftOptions): boolean;
  setDraft(input: TInput, identity: EntityDraftIdentityInput): TInput;
  setDraftMany(
    input: readonly TInput[],
    identity: EntityDraftIdentityInput,
  ): readonly TInput[];
  clearDraft(id: TId, identity: EntityDraftIdentityInput): boolean;
  clearDraftMany(ids: readonly TId[], identity: EntityDraftIdentityInput): readonly TId[];
  clearDraftByIdentity(identityKey: string, options?: EntityDraftOptions): readonly TId[];
  commitDraft(id: TId, identity: EntityDraftCommitInput): TInput | undefined;
  commitDraftMany(
    ids: readonly TId[],
    identity: EntityDraftCommitInput,
  ): readonly TInput[];
}

export interface MergeEntityInput<TInput extends object> {
  current: TInput | undefined;
  next: TInput;
  shouldMerge: boolean;
}

export interface IsEquivalentEntityInput<TInput extends object> {
  current: TInput;
  next: TInput;
}

export interface EntityUnitState<TId extends EntityId> {
  onChange: () => void;
  membershipIds: Set<TId>;
}

export interface EntityUnitKeyInput<TId extends EntityId> {
  id: TId;
  key: string;
}

export interface TimeoutRuntime {
  setTimeout: (callback: () => void, delay: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}
