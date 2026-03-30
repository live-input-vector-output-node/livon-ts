import type { SourceConfig } from '../source/index.js';
import type {
  UnitDataByEntityMode,
  UnitEntityMode,
} from '../utils/index.js';
import type {
  DraftConfig,
  DraftRunContext,
  DraftRunResult,
} from './types.js';

interface CreateDraftSourceConfigInput<
  TIdentity extends object | undefined,
  TMeta,
  TEntity extends object,
  TMode extends UnitEntityMode,
> {
  config: DraftConfig<TIdentity, TEntity, TMode, TMeta>;
  resolveClear: (identity: TIdentity) => void;
}

export const createDraftSourceConfig = <
  TIdentity extends object | undefined,
  TMeta,
  TEntity extends object,
  TMode extends UnitEntityMode,
>({
  config,
  resolveClear,
}: CreateDraftSourceConfigInput<TIdentity, TMeta, TEntity, TMode>): SourceConfig<
  TIdentity,
  undefined,
  TEntity,
  TMode,
  TMeta
> => {
  return {
    key: config.key,
    ttl: config.ttl,
    cache: config.cache,
    destroyDelay: config.destroyDelay,
    run: (context): Promise<DraftRunResult> | DraftRunResult => {
      if (!config.run) {
        return undefined;
      }

      const draftContext: DraftRunContext<
        TIdentity,
        UnitDataByEntityMode<TEntity, TMode>,
        TMeta,
        TEntity
      > = {
        identity: context.identity,
        value: context.value,
        status: context.status,
        meta: context.meta,
        context: context.context,
        setMeta: context.setMeta,
        upsertOne: context.upsertOne,
        upsertMany: context.upsertMany,
        deleteOne: context.deleteOne,
        deleteMany: context.deleteMany,
        getValue: context.getValue,
        set: context.set,
        clear: () => resolveClear(context.identity),
        reset: context.reset,
      };
      return config.run(draftContext);
    },
    defaultValue: config.defaultValue,
  };
};
