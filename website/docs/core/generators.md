---
title: Generators
sidebar_position: 3
---

## Monorepo generator commands

```sh
pnpm gen lib <name>
pnpm gen node <name>
pnpm gen browser <name>
pnpm gen rsbuild <name>
pnpm gen rspack <name>
pnpm gen frontend <name>
```

### Parameters

- `<type>`: generator template family (`lib`, `node`, `browser`, `rsbuild`, `rspack`, `frontend`).
- `<name>`: target package/app name used for folder and package metadata.

## Update existing generated package

```sh
pnpm gen <type> update <name>
```

### Parameters

- `<type>`: generator template family for the target.
- `<name>`: existing package/app name to update from template.

## Compare current package to generator template

```sh
pnpm gen <type> diff <name>
```

### Parameters

- `<type>`: generator template family for the target.
- `<name>`: existing package/app name to compare with current template.

## Policies

Run policy checks before merge:

```sh
pnpm check:policies
```
