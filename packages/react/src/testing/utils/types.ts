import type {
  Action,
  ActionConfig,
  Entity,
  Source,
  SourceConfig,
  Stream,
  StreamConfig,
} from '@livon/sync';

export interface User {
  id: string;
  name: string;
}

export interface UserSlug {
  templateId: string;
}

export interface MessageMeta {
  severity: string;
  text: string;
}

export interface CreateRandomUserInput {
  idPrefix?: string;
  namePrefix?: string;
}

export interface CreateTemplateSlugInput {
  prefix?: string;
}

export interface CreateReadUserSourceInput {
  entity?: UserEntity;
  run?: ReadUserRun;
}

export interface CreateCreateUserActionInput {
  entity?: UserEntity;
  run?: CreateUserRun;
}

export interface CreateUserUpdatedStreamInput {
  entity?: UserEntity;
  run?: UserUpdatedRun;
}

export type UserEntity = Entity<User>;
export type ReadUserSource = Source<UserSlug, undefined, User | null, User | null>;
export type CreateUserAction = Action<UserSlug, User, User | null, User | null>;
export type UserUpdatedStream = Stream<UserSlug, User, User | null, User | null>;
export type ReadUserRun = SourceConfig<UserSlug, undefined, User, User | null, User | null>['run'];
export type CreateUserRun = ActionConfig<UserSlug, User, User, User | null, User | null>['run'];
export type UserUpdatedRun = StreamConfig<UserSlug, User, User, User | null, User | null>['run'];
