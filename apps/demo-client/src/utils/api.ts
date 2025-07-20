import { runtime } from '@livon/core/runtime.js';
import { transportWsClient } from '@livon/transport-ws-client';
console.log('websocket')
await runtime(
  transportWsClient('ws://localhost:3000')
).then(({ }) => {
});