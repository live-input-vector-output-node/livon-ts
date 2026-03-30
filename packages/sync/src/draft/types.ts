import {
  type Entity,
  type EntityDraftCommitInput,
  type EntityDraftIdentityInput,
  type EntityDraftMode,
  type EntityDraftOptions,
  type EntityId,
  type UpsertOptions,
} from '../entity.js';
import type {
  SourceCleanup,
  SourceContext,
  SourceRunResult,
} from '../source/index.js';
import type {
  EntityValueOfStore,
  RunContextBase,
  Snapshot,
  UnitBuilderInput,
  UnitDataByEntityMode,
  UnitDataEntity,
  UnitEntityMode,
  ValueUpdater,
} from '../utils/index.js';

export type DraftCleanup = SourceCleanup;
export type DraftRunResult = SourceRunResult;
export type DraftContext = SourceContext;

export type DraftStatus = 'dirty' | 'clear';
export type DraftMode = EntityDraftMode;

export interface DraftState {
  dirty: boolean;
  ownerIdentityKey: string | null;
  hasQueuedChanges: boolean;
  mode: DraftMode | null;
  localIdentityKey: string | null;
}

export interface DraftEntityMethods<TEntity extends object> {
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

export type DraftSetValue<
  TData,
  TEntity extends object,
> = TData extends readonly TEntity[]
  ? readonly (TEntity | Partial<TEntity>)[]
  : TEntity | Partial<TEntity>;

export interface DraftSetUpdater<
  TData,
  TEntity extends object,
> {
  (previous: TData): DraftSetValue<TData, TEntity>;
}

export type DraftSetInput<
  TData,
  TEntity extends object,
> = DraftSetValue<TData, TEntity> | DraftSetUpdater<TData, TEntity>;

export interface DraftRunContext<
  TIdentity,
  TData,
  TMeta = unknown,
  TEntity extends object = UnitDataEntity<TData>,
> extends RunContextBase<
  TIdentity,
  TData,
  TMeta,
  DraftContext
> {
  setMeta: (meta: TMeta | null | ValueUpdater<TMeta | null, TMeta | null>) => void;
  upsertOne: (input: TEntity, options?: UpsertOptions) => TEntity;
  upsertMany: (
    input: readonly TEntity[],
    options?: UpsertOptions,
  ) => readonly TEntity[];
  deleteOne: (id: EntityId) => boolean;
  deleteMany: (ids: readonly EntityId[]) => readonly EntityId[];
  getValue: () => TData;
  set: (input: TData | ValueUpdater<TData, TData>) => void;
  clear: () => void;
  reset: () => void;
}

export interface DraftConfig<
  TIdentity extends object | undefined,
  TEntity extends object,
  TMode extends UnitEntityMode,
  TMeta = unknown,
> {
  key: string;
  mode?: DraftMode;
  ttl?: number;
  cache?: {
    key?: string;
    ttl?: number | 'infinity';
    lruMaxEntries?: number;
  };
  destroyDelay?: number;
  run?: (
    context: DraftRunContext<
      TIdentity,
      UnitDataByEntityMode<TEntity, TMode>,
      TMeta,
      TEntity
    >,
  ) => Promise<DraftRunResult> | DraftRunResult;
  defaultValue?: UnitDataByEntityMode<TEntity, TMode>;
}

export type DraftMetaOfConfig<TConfig> =
  TConfig extends DraftConfig<object | undefined, object, UnitEntityMode, infer TMeta>
    ? TMeta
    : never;

export type DraftBuilderInput<
  TEntityStore extends Entity<object, EntityId>,
  TMode extends UnitEntityMode,
> = UnitBuilderInput<TEntityStore, TMode>;

export interface DraftByEntityModeBuilder<
  TEntityStore extends Entity<object, EntityId>,
  TMode extends UnitEntityMode,
> {
  <
    TIdentity extends object | undefined,
  >(
    config: DraftConfig<
      TIdentity,
      EntityValueOfStore<TEntityStore>,
      TMode,
      unknown
    >,
  ): Draft<
    TIdentity,
    UnitDataByEntityMode<EntityValueOfStore<TEntityStore>, TMode>,
    unknown,
    EntityValueOfStore<TEntityStore>
  >;
  <
    TIdentity extends object | undefined,
    TMeta,
  >(
    config: DraftConfig<
      TIdentity,
      EntityValueOfStore<TEntityStore>,
      TMode,
      TMeta
    >,
  ): Draft<
    TIdentity,
    UnitDataByEntityMode<EntityValueOfStore<TEntityStore>, TMode>,
    TMeta,
    EntityValueOfStore<TEntityStore>
  >;
}

export interface DraftBuilder {
  <
    TEntityStore extends Entity<object, EntityId>,
    TMode extends UnitEntityMode,
  >(
    input: DraftBuilderInput<TEntityStore, TMode>,
  ): DraftByEntityModeBuilder<TEntityStore, TMode>;
}

export interface DraftRun {
  (): Promise<void>;
}

export type DraftHydrate = DraftRun;

export type DraftSnapshot<
  TIdentity,
  TData,
  TMeta = unknown,
  TEntity extends object = UnitDataEntity<TData>,
> = Snapshot<
  TData,
  DraftStatus,
  TMeta,
  {
    context: DraftContext;
    identity: TIdentity;
    set: (input: DraftSetInput<TData, TEntity>) => void;
    clear: () => void;
    reset: () => void;
  }
>;

export interface DraftSnapshotListener<
  TIdentity,
  TData,
  TMeta = unknown,
  TEntity extends object = UnitDataEntity<TData>,
> {
  (snapshot: DraftSnapshot<TIdentity, TData, TMeta, TEntity>): void;
}

export interface DraftUnit<
  TIdentity extends object | undefined,
  TData,
  TMeta = unknown,
  TEntity extends object = UnitDataEntity<TData>,
> {
  getSnapshot: () => DraftSnapshot<TIdentity, TData, TMeta, TEntity>;
  subscribe: (
    listener: DraftSnapshotListener<TIdentity, TData, TMeta, TEntity>,
  ) => (() => void) | void;
}

export interface Draft<
  TIdentity extends object | undefined = object | undefined,
  TData = unknown,
  TMeta = unknown,
  TEntity extends object = UnitDataEntity<TData>,
> {
  (identity: TIdentity): DraftUnit<TIdentity, TData, TMeta, TEntity>;
}
