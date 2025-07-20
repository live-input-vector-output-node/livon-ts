import { createRefloMiddleware } from '../../core/dist/createRefloMiddleware.js';
import { WebSocket, ServerOptions, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http'
import { encode, decode } from '@msgpack/msgpack';

export const transportWsServer = <
  TWebSocket extends typeof WebSocket = typeof WebSocket,
  TIncomingMessage extends typeof IncomingMessage = typeof IncomingMessage,
>(config: ServerOptions<TWebSocket, TIncomingMessage>) => {
  return createRefloMiddleware('transportWsServer', ({
    emitConnect,
    emitMessage,
    emitError,
  }) => {

    console.log(emitConnect,emitMessage, emitError)
    const server = new WebSocketServer(config);

    server.on('error', (error) => {
      console.error('WebSocket server error:', error);
      emitError({});
    });

    server.on('connection', (ws, req) => {
      console.log('connection')
      ws.binaryType = 'arraybuffer';
      emitConnect({});


      ws.on('message', (message) => {
        emitMessage({});       
        ws.send(encode({x: "string"}), { binary: true })
      });

      ws.on('error', (error) => {
        emitError({});
      })
    });
  })
}