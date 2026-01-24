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
              <img className={styles.heroLogo} src={logoUrl} alt="LIVON Logo" />
              <Heading as="h1" className={styles.heroTitle}>
                FULLSTACK REALTIME RUNTIME
              </Heading>
              <p className={styles.heroSubtitle}>A composable event runtime for modular, predictable system design.</p>
              <p className={styles.heroCatcher}>
                LIVON is a schema-first runtime ecosystem for full-stack real-time applications. You define contracts
                once, validate data at runtime, and generate typed client APIs from the same source so server and
                client stay aligned without manual duplicate types.
              </p>
              <div className={styles.heroActions}>
                <Link className="button button--primary button--lg" to="/docs/core/what-is-livon">
                  Why LIVON
                </Link>
                <Link className="button button--secondary button--lg" to="/docs/core/getting-started">
                  Getting Started
                </Link>
                <Link className="button button--secondary button--lg" to="/docs/technical/architecture">
                  Architecture
                </Link>
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
                <CodeBlock language="ts">{`import { runtime } from '@livon/runtime';
import { schemaModule } from '@livon/schema';
import { nodeWsTransport } from '@livon/node-ws-transport';

runtime(
  nodeWsTransport({ server: wsServer }),
  schemaModule(serverSchema, { explain: true }),
);`}</CodeBlock>
              </article>
              <article className={`${styles.card} ${styles.heroCodeCard}`}>
                <Heading as="h3">State</Heading>
                <CodeBlock language="ts">{`import {createStore} from 'zustand/vanilla';
import {api} from './generated/api.js';

interface ChatState {
  messages: string[];
}

export const chatStore = createStore<ChatState>((set) => {
  api({
    onMessage: (payload) =>
      set((state) => ({
        ...state,
        messages: [...state.messages, payload.text],
      })),
  });

  return {
    messages: [],
  };
});`}</CodeBlock>
              </article>
              <article className={`${styles.card} ${styles.heroCodeCard}`}>
                <Heading as="h3">Browser</Heading>
                <CodeBlock language="ts">{`import { runtime } from '@livon/runtime';
import { clientWsTransport } from '@livon/client-ws-transport';
import {api} from './generated/api.js';

const transport = clientWsTransport({ url: 'ws://localhost:3002/ws' });

runtime(transport, api);`}</CodeBlock>
              </article>
              <article className={`${styles.card} ${styles.heroCodeCard}`}>
                <Heading as="h3">API Schema</Heading>
                <CodeBlock language="ts">{`import {
  api,
  createSchemaModuleInput,
  object,
  operation,
  string,
  subscription,
} from '@livon/schema';

const messageInput = object({
  name: 'MessageInput',
  shape: {
    author: string(),
    text: string(),
  },
});

const message = object({
  name: 'Message',
  shape: {
    author: string(),
    text: string(),
  },
});

const sendMessage = operation({
  input: messageInput,
  output: message,
  exec: async (input) => input,
  publish: {
    onMessage: (output) => output,
  },
});

export const apiSchema = api({
  operations: {sendMessage},
  subscriptions: {onMessage: subscription({payload: message})},
});

export const serverSchema = createSchemaModuleInput(apiSchema);`}</CodeBlock>
              </article>
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className="container">
            <Heading as="h2">Quick Start</Heading>
            <p className={styles.lead}>
              LIVON docs are split into Main, Technical, Contribution, and Packages sections.
            </p>
            <div className={styles.cardGrid}>
              <article className={styles.card}>
                <Heading as="h3">Main Docs</Heading>
                <p>Onboarding and minimal setup path to run LIVON quickly.</p>
                <Link to="/docs/core/getting-started">Open Getting Started</Link>
              </article>
              <article className={styles.card}>
                <Heading as="h3">Technical Docs</Heading>
                <p>Deep architecture and envelope flow from runtime to schema and transport.</p>
                <Link to="/docs/technical/architecture">Open Technical Docs</Link>
              </article>
              <article className={styles.card}>
                <Heading as="h3">Package Docs</Heading>
                <p>How to install and use every module from `@livon/runtime` to `@livon/cli`.</p>
                <Link to="/docs/packages/runtime">Go to Package Docs</Link>
              </article>
              <article className={styles.card}>
                <Heading as="h3">Contribution Docs</Heading>
                <p>Generators, quality gates, and contribution process for maintainers.</p>
                <Link to="/docs/core/contributing">Open Contribution Docs</Link>
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
