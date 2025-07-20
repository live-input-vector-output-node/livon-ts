import { createRefloMiddleware } from '@livo/core/createRefloMiddleware.js';
import type { IncomingMessage } from 'http'
import { encode, decode } from '@msgpack/msgpack'

export const transportWsClient = <
  TWebSocket extends typeof WebSocket = typeof WebSocket,
  TIncomingMessage extends typeof IncomingMessage = typeof IncomingMessage,
>(url: string | URL, protocols?: string | string[]) => {
  return createRefloMiddleware('transportWsServer', ({
    emitConnect,
    emitMessage,
    emitDisconnect,
    emitError,
    onMessage,
    onSend
  }) => {
    const ws = new WebSocket(url, protocols);
    ws.binaryType = 'arraybuffer';

    onSend(({ event }) => {
      ws.send(encode(event))
    });

    ws.addEventListener('message', async (message) => {
      try {
        const decodedMessage = decode(message.data);
        console.log('Received message:', decodedMessage);
        emitMessage({ event: decodedMessage);
      } catch (error) {
        console.log(error);
        emitError({});
      }
    });
    ws.addEventListener('error', (ev) => {
      console.log('WebSocket error:', ev);
    });
    ws.addEventListener('close', (ev) => {
      emitDisconnect({});
    });
    return {}
  })
}