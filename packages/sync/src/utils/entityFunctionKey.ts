import { serializeKey } from './serializeKey.js';

export interface ResolveEntityFunctionKeyInput {
  entityKey: string;
  functionKey: string;
}

export interface ResolveEntityFunctionIdentityKeyInput {
  entityFunctionKey: string;
  identityKey: string;
}

export const resolveEntityFunctionKey = ({
  entityKey,
  functionKey,
}: ResolveEntityFunctionKeyInput): string => {
  return serializeKey({
    entityKey,
    functionKey,
  });
};

export const resolveEntityFunctionIdentityKey = ({
  entityFunctionKey,
  identityKey,
}: ResolveEntityFunctionIdentityKeyInput): string => {
  return `${entityFunctionKey}:${identityKey}`;
};
