import type {
  Entity,
  EntityId,
} from '../entity.js';
import type {
  UnitDataByEntityMode,
  UnitEntityMode,
} from './unitDataTypes.js';

export interface UnitConfigWithEntity {
  entity: Entity<object, EntityId>;
  entityMode: UnitEntityMode;
}

export interface UnitBuilderInput<
  TEntityStore extends Entity<object, EntityId>,
  TMode extends UnitEntityMode,
> {
  entity: TEntityStore & Entity<EntityValueOfStore<TEntityStore>, EntityId>;
  mode: TMode;
}

export type EntityValueOfStore<TStore extends Entity<object, EntityId>> =
  TStore extends Entity<infer TValue, EntityId>
    ? TValue
    : never;

export type UnitDataOfConfig<TConfig extends UnitConfigWithEntity> = UnitDataByEntityMode<
  EntityValueOfStore<TConfig['entity']>,
  TConfig['entityMode']
>;
