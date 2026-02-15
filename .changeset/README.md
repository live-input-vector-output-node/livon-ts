## Changesets

This repository uses Changesets to keep all publishable `@livon/*` packages in sync.

### Create a changeset

```sh
pnpm changeset
```

### Apply version updates

```sh
pnpm changeset:version
```

### Publish to npm

```sh
pnpm changeset:publish --tag rc
pnpm changeset:publish --tag latest
```
