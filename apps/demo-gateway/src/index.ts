import { runtime } from '@livon/core/runtime.js';
import { transportWsGateway } from '@livon/transport-ws-gateway';
import { moduleSchema } from '@livon/module-schema';
import { managerRetry } from '@livon/manager-retry';
await runtime(
  transportWsGateway({ port: 3001 }),
  managerRetry(),
  moduleSchema()
);