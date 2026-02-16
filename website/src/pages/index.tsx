import {type ReactNode, useEffect, useState} from 'react';
import Link from '@docusaurus/Link';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import CodeBlock from '@theme/CodeBlock';
import HomepageFeatures from '@site/src/components/HomepageFeatures';

import styles from './index.module.css';

const Home = (): ReactNode => {
  const logoUrl = useBaseUrl('img/logo.svg');
  const [showScrollHint, setShowScrollHint] = useState(true);

  useEffect(() => {
    const onScroll = () => {
      setShowScrollHint(window.scrollY <= 8);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, {passive: true});

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <Layout title="Documentation" description="LIVON docs for core concepts and all packages.">
      <main>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroIntro}>
              <div className={styles.heroIntroGrid}>
                <div className={styles.heroBrandGroup}>
                  <img className={styles.heroLogo} src={logoUrl} alt="LIVON Logo" />
                  <p className={styles.heroSubtitle}>
                    The real-time runtime with API sync for full-stack systems.
                  </p>
                </div>
                <div className={styles.heroValueGroup}>
                  <ul className={styles.heroValueList}>
                    <li>Realtime API interfaces that stay in sync.</li>
                    <li>Type-safe, validated payloads across frontend and backend.</li>
                    <li>Generated client APIs with JSDoc and sync workflow.</li>
                  </ul>
                </div>
                <div className={styles.heroActionGroup}>
                  <div className={styles.heroActions}>
                    <Link className="button button--primary button--lg" to="/docs/core/why-livon-exists">
                      Why LIVON
                    </Link>
                    <Link className="button button--secondary button--lg" to="/docs/core/getting-started">
                      Getting Started
                    </Link>
                    <Link className="button button--secondary button--lg" to="/docs/packages/cli">
                      Client Sync
                    </Link>
                  </div>
                </div>
              </div>
              {showScrollHint && (
                <a className={styles.scrollHint} href="#home-content" aria-label="Scroll down for more content">
                  <svg className={styles.scrollHintIcon} viewBox="0 0 48 28" aria-hidden>
                    <path d="M4 6 L24 22 L44 6" />
                  </svg>
                </a>
              )}
            </div>
            <div className={styles.heroCodeGrid} id="home-content">
              <article className={`${styles.card} ${styles.heroCodeCard}`}>
                <Heading as="h3">Server</Heading>
                <CodeBlock language="ts">{`import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { runtime } from '@livon/runtime';
import { schemaModule } from '@livon/schema';
import { nodeWsTransport } from '@livon/node-ws-transport';
import { serverSchema } from './schema.js';

const httpServer = createServer();
const wsServer = new WebSocketServer({ server: httpServer, path: '/ws' });

runtime(
  nodeWsTransport({ server: wsServer }),
  schemaModule(serverSchema, { explain: true }),
);

httpServer.listen(3002, '127.0.0.1');`}</CodeBlock>
              </article>
              <article className={`${styles.card} ${styles.heroCodeCard}`}>
                <Heading as="h3">Client Sync (Required)</Heading>
                <CodeBlock language="sh">{`livon --endpoint ws://127.0.0.1:3002/ws --out src/generated/api.ts --poll 2000 -- pnpm dev`}</CodeBlock>
              </article>
              <article className={`${styles.card} ${styles.heroCodeCard}`}>
                <Heading as="h3">Browser</Heading>
                <CodeBlock language="ts">{`import { runtime } from '@livon/runtime';
import { clientWsTransport } from '@livon/client-ws-transport';
import { api } from './generated/api.js';

runtime(clientWsTransport({ url: 'ws://127.0.0.1:3002/ws' }), api);

api({
  onMessage: (payload) => {
    console.log(payload.text);
  },
});

await api.sendMessage({
  author: 'Alice',
  text: 'Hello from LIVON',
});`}</CodeBlock>
              </article>
              <article className={`${styles.card} ${styles.heroCodeCard}`}>
                <Heading as="h3">API Schema</Heading>
                <CodeBlock language="ts">{`import {
  and,
  api,
  object,
  operation,
  string,
  subscription,
} from '@livon/schema';

const MessageInput = object({
  name: 'MessageInput',
  shape: {
    author: string(),
    text: string(),
  },
});

const WithId = object({ name: 'WithId', shape: { id: string() } });

const MessageWithId = and({ left: MessageInput, right: WithId });

const sendMessage = operation({
  input: MessageInput,
  output: MessageWithId,
  exec: async (input) => ({ ...input, id: 'msg-1' }),
  publish: {
    onMessage: (output) => output,
  },
});

export const ApiSchema = api({
  operations: {sendMessage},
  subscriptions: {onMessage: subscription({payload: MessageWithId})},
});

export const serverSchema = ApiSchema;`}</CodeBlock>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className="container">
            <Heading as="h2">Quick Start</Heading>
            <p className={styles.lead}>
              Start with the concept, run the sync, and ship your first realtime API sync flow fast.
            </p>
            <div className={styles.cardGrid}>
              <article className={styles.card}>
                <Heading as="h3">Core Concepts</Heading>
                <p>Why teams adopt LIVON and how one schema model reduces integration friction.</p>
                <Link to="/docs/core/why-livon-exists">Open Core Concepts</Link>
              </article>
              <article className={styles.card}>
                <Heading as="h3">Guides</Heading>
                <p>Hands-on setup to go from zero to synced backend and frontend interfaces.</p>
                <Link to="/docs/core/getting-started">Open Getting Started</Link>
              </article>
              <article className={styles.card}>
                <Heading as="h3">Technical Docs</Heading>
                <p>Deep dive into runtime flow, transport integration, and internals.</p>
                <Link to="/docs/technical/architecture">Open Technical Docs</Link>
              </article>
              <article className={styles.card}>
                <Heading as="h3">Package Docs</Heading>
                <p>Use each `@livon/*` package directly with practical API references and examples.</p>
                <Link to="/docs/packages/runtime">Go to Package Docs</Link>
              </article>
            </div>
          </div>
        </section>

        <HomepageFeatures />
      </main>
    </Layout>
  );
};

export default Home;
