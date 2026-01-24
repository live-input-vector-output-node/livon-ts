import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';

import styles from './styles.module.css';

interface FeatureItem {
  title: string;
  description: string;
  to: string;
}

const featureList: readonly FeatureItem[] = [
  {
    title: '@livon/runtime',
    description: 'Event envelope lifecycle, room scoping, hooks, and module composition.',
    to: '/docs/packages/runtime',
  },
  {
    title: '@livon/schema',
    description: 'Schema-first contracts for operations, subscriptions, parsing, and AST.',
    to: '/docs/packages/schema',
  },
  {
    title: 'Transports + Tooling',
    description: 'Node/client websocket transports, DLQ module, config package, and CLI.',
    to: '/docs/packages/client-ws-transport',
  },
];

const HomepageFeatures = (): ReactNode => (
  <section className={styles.features}>
    <div className="container">
      <Heading as="h2">Package Guide</Heading>
      <p className={styles.subtitle}>
        Every package has a dedicated doc page with install commands, runtime wiring, and usage examples.
      </p>
      <div className={styles.grid}>
        {featureList.map((item) => (
          <article key={item.title} className={styles.card}>
            <Heading as="h3">{item.title}</Heading>
            <p>{item.description}</p>
            <Link to={item.to}>Read documentation</Link>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default HomepageFeatures;
