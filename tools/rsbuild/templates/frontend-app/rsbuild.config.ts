import { base, compose, entry, html, react } from '@livon/rsbuild';

export default compose(base(), entry('./src/index.tsx'), html('./public/index.html'), react());
