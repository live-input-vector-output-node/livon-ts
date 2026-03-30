import { type Entity, type EntityId } from '../entity.js';
import type { ReadById } from './entityMode.js';

interface CreateEntityValueReaderInput<
  TEntity extends object,
  TEntityId extends EntityId,
> {
  entity: Entity<TEntity, TEntityId>;
  identityKey: string;
  localIdentityKey: string;
}

export const createEntityValueReader = <
  TEntity extends object,
  TEntityId extends EntityId,
>({
  entity,
  identityKey,
  localIdentityKey,
}: CreateEntityValueReaderInput<TEntity, TEntityId>): ReadById<TEntityId, TEntity> => {
  return (id) => {
    return entity.getByIdForIdentityContext({
      id,
      identityKey,
      localIdentityKey,
    });
  };
};
