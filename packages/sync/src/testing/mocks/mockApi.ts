interface EventHandlerMap<TEntity extends object> {
  insert: Array<(entity: TEntity) => void>;
  update: Array<(entity: TEntity) => void>;
  delete: Array<(entity: TEntity) => void>;
}

type EventName = 'insert' | 'update' | 'delete';

export interface MockApi<TEntity extends object> {
  data: TEntity[];
  insert: (entity: TEntity) => Promise<TEntity>;
  findOne: (filter: Partial<TEntity>) => Promise<TEntity | undefined>;
  findMany: (filter: Partial<TEntity>) => Promise<TEntity[]>;
  update: (filter: Partial<TEntity>, update: Partial<TEntity>) => Promise<TEntity | null>;
  delete: (filter: Partial<TEntity>) => Promise<boolean>;
  onCreatedOne: (filter: Partial<TEntity>, callback: (entity: TEntity) => void) => void;
  onUpdatedOne: (filter: Partial<TEntity>, callback: (entity: TEntity) => void) => void;
  onDeletedOne: (filter: Partial<TEntity>, callback: (entity: TEntity) => void) => void;
  prune: () => void;
}

const compareFilters = <TEntity extends object>(
  entity: TEntity,
  filter: Partial<TEntity>,
): boolean => {
  const entries = Object.entries(filter) as Array<[keyof TEntity, TEntity[keyof TEntity] | undefined]>;

  return entries
    .filter(([, value]) => value !== undefined)
    .every(([key, value]) => entity[key] === value);
};

const createEventEmitter = <TEntity extends object>() => {
  const handlers: EventHandlerMap<TEntity> = {
    insert: [],
    update: [],
    delete: [],
  };

  const on = (event: EventName, callback: (entity: TEntity) => void): void => {
    handlers[event].push(callback);
  };

  const emit = (event: EventName, entity: TEntity): void => {
    handlers[event].forEach((callback) => {
      callback(entity);
    });
  };

  return {
    on,
    emit,
  };
};

export const mockApi = <TEntity extends object>(): MockApi<TEntity> => {
  const eventEmitter = createEventEmitter<TEntity>();

  const mockedApi: MockApi<TEntity> = {
    data: [],
    insert: async (entity) => {
      mockedApi.data.push(entity);
      eventEmitter.emit('insert', entity);
      return entity;
    },
    findOne: async (filter) => {
      return mockedApi.data.find((entity) => compareFilters(entity, filter));
    },
    findMany: async (filter) => {
      return mockedApi.data.filter((entity) => compareFilters(entity, filter));
    },
    update: async (filter, update) => {
      const index = mockedApi.data.findIndex((entity) => compareFilters(entity, filter));

      if (index === -1) {
        return null;
      }

      const current = mockedApi.data[index];

      if (!current) {
        return null;
      }

      const nextEntity = {
        ...current,
        ...update,
      };

      mockedApi.data[index] = nextEntity;
      eventEmitter.emit('update', nextEntity);

      return nextEntity;
    },
    delete: async (filter) => {
      const index = mockedApi.data.findIndex((entity) => compareFilters(entity, filter));

      if (index === -1) {
        return false;
      }

      const entity = mockedApi.data[index];

      if (!entity) {
        return false;
      }

      mockedApi.data.splice(index, 1);
      eventEmitter.emit('delete', entity);

      return true;
    },
    onCreatedOne: (filter, callback) => {
      eventEmitter.on('insert', (entity) => {
        if (compareFilters(entity, filter)) {
          callback(entity);
        }
      });
    },
    onUpdatedOne: (filter, callback) => {
      eventEmitter.on('update', (entity) => {
        if (compareFilters(entity, filter)) {
          callback(entity);
        }
      });
    },
    onDeletedOne: (filter, callback) => {
      eventEmitter.on('delete', (entity) => {
        if (compareFilters(entity, filter)) {
          callback(entity);
        }
      });
    },
    prune: () => {
      mockedApi.data = [];
    },
  };

  return mockedApi;
};
