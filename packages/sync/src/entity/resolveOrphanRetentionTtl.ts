import type {
  CacheConfig,
  CacheTtl,
} from './types.js';

interface ResolveOrphanRetentionTtlInput {
  cache?: CacheConfig;
  ttl?: number;
}

export const resolveOrphanRetentionTtl = ({
  cache,
  ttl,
}: ResolveOrphanRetentionTtlInput): CacheTtl => {
  if (cache?.ttl !== undefined) {
    return cache.ttl;
  }

  if (ttl !== undefined) {
    return ttl;
  }

  return 0;
};
