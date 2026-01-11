import { startServer } from './server.js';
import { boolean, literal, number, or } from '@livon/schema';

export interface StartFromEnvInput {
  host?: string;
  port?: number;
}

const OptionalServerPortFromEnv = number({ name: 'OptionalServerPortFromEnv' })
  .refine({
    predicate: (value) => Number.isInteger(value),
    message: 'Expected integer port value.',
    code: 'env.port.integer',
  })
  .refine({
    predicate: (value) => value > 0,
    message: 'Expected positive port value.',
    code: 'env.port.positive',
  })
  .optional()
  .before((input) => {
    if (input === undefined || input === null) {
      return { input: undefined };
    }
    if (typeof input !== 'string') {
      return { input };
    }
    const normalized = input.trim();
    if (normalized.length === 0) {
      return { input: undefined };
    }
    return { input: Number(normalized) };
  });

const OptionalExplainFromEnv = or({
  name: 'OptionalExplainFromEnv',
  options: [
    boolean({ name: 'ExplainBoolean' }),
    literal({ name: 'ExplainTrue', value: 'true' }).after(() => true),
    literal({ name: 'ExplainFalse', value: 'false' }).after(() => false),
    literal({ name: 'ExplainYes', value: 'yes' }).after(() => true),
    literal({ name: 'ExplainNo', value: 'no' }).after(() => false),
    literal({ name: 'ExplainOne', value: '1' }).after(() => true),
    literal({ name: 'ExplainZero', value: '0' }).after(() => false),
  ] as const,
})
  .optional()
  .before((input) => {
    if (input === undefined || input === null) {
      return { input: undefined };
    }
    if (typeof input !== 'string') {
      return { input };
    }
    const normalized = input.trim().toLowerCase();
    if (normalized.length === 0) {
      return { input: undefined };
    }
    return { input: normalized };
  });

const startFromEnv = async (input: StartFromEnvInput = {}) => {
  const host = input.host ?? process.env.HOST;
  const port = input.port ?? OptionalServerPortFromEnv.parse(process.env.LIVON_PORT ?? process.env.PORT);
  const explain = OptionalExplainFromEnv.parse(process.env.LIVON_EXPLAIN);
  return startServer({ host, port, explain });
};

const registerShutdown = (close: () => Promise<void>) => {
  let shuttingDown = false;
  const handle = (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    // eslint-disable-next-line no-console
    console.log(`livon: received ${signal}, shutting down...`);
    close()
      .then(() => {
        // eslint-disable-next-line no-console
        console.log('livon: shutdown complete');
        process.exit(0);
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('livon: shutdown error', error);
        process.exit(1);
      });
  };

  process.once('SIGINT', () => handle('SIGINT'));
  process.once('SIGTERM', () => handle('SIGTERM'));
};

void startFromEnv()
  .then((started) => {
    registerShutdown(started.close);
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
