import { createRefloMiddleware } from '../../core/dist/createRefloMiddleware.js';
import { WebSocket, ServerOptions, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http'
import { encode, decode } from '@msgpack/msgpack';

export const transportWsGateway = <
  TWebSocket extends typeof WebSocket = typeof WebSocket,
  TIncomingMessage extends typeof IncomingMessage = typeof IncomingMessage,
>(config: ServerOptions<TWebSocket, TIncomingMessage>) => {
  return createRefloMiddleware('transportWsServer', ({
    emitConnect,
    emitMessage,
    emitError,
    onMessage,
  }) => {

    const server = new WebSocketServer(config);

    onMessage((context) => {
      return context;
    })

    server.on('error', (error) => {
      console.error('WebSocket server error:', error);
      emitError({});
    });

    server.on('connection', (ws) => {
      ws.binaryType = 'arraybuffer';
      emitConnect({});


      ws.on('message', (message) => {
        emitMessage({});
        console.log(decode(message as ArrayBuffer));

        ws.send(encode({ x: "string" }), { binary: true })
      });

      ws.on('error', (error) => {
        emitError({});
      })
    });
  })
}