import type {
  Entity,
  Source,
  SourceConfig,
} from '@livon/sync';

export interface Todo {
  id: string;
  title: string;
}

export interface TodoIdentity {
  listId: string;
}

export interface MessageMeta {
  severity: string;
  text: string;
}

export interface CreateRandomTodoInput {
  idPrefix?: string;
  titlePrefix?: string;
}

export interface CreateTodoIdentityInput {
  prefix?: string;
}

export interface CreateReadTodoSourceInput {
  entity?: TodoEntity;
  run?: ReadTodoRun;
}

export type TodoEntity = Entity<Todo>;
export type ReadTodoSource = Source<TodoIdentity, undefined, Todo | null>;
export type ReadTodoRun = SourceConfig<TodoIdentity, undefined, Todo, 'one'>['run'];
