# Veraswap SDK Monorepo

Veraswap sdk monorepo designed to work with pnpm and turbo repo.

## Table of Contents

- [TLDR](#tldr)
- [Dev Tools](#dev-tools)
- [Release](#release)

## Install
```bash
pnpm install
```

## Dev Tools
Comes out of the box with configuration for helpful devtools
- [pnpm](https://pnpm.io/): Efficient package manager used for [workspace](https://pnpm.io/workspaces) management configured in [pnpm-workspace.yaml](./pnpm-workspace.yaml) and hoisting configured in [.npmrc](./.npmrc)
- [syncpack](https://github.com/JamieMason/syncpack): Sync dependency Versions
- [depcheck](https://github.com/depcheck/depcheck): Eliminate unused dependencies
- [dotenv](https://github.com/motdotla/dotenv) & [dotenv-vault](https://github.com/dotenv-org/dotenv-vault): For local & remote envvar management
- [turborepo](https://turbo.build/repo/docs): For build step caching in large monorepos with configuration in [turbo.json](./turbo.json)
- [changesets](https://github.com/changesets/changesets): For automated package release management
- [esbuild](https://esbuild.github.io/): For fast Typescript transpilation to JS with shared config
- [eslint](https://eslint.org/): For linting with shared config

Additional configs include
- [.vscode/extensions.json](./.vscode/extensions.json): Recommended VSCode extensions
- [.vscode/settings.json](./.vscode/settings.json): Recommended VSCode settings
- [.github/workflows/build.yml](./github/workflows/build.yml): Github Action CI

## Release
We follow the guide from [pnpm.io/using-changesets](https://pnpm.io/using-changesets) to release packages.

### Create Changeset
Add a changeset by first running:

```bash
pnpm changeset
```

Then you would select the packages you intend to bump.

Typically want a `patch` bump on the package you want to publish, not a `major` or `minor`.

> Major and minor bumps we assume are done manually.

E.g. if you're publishing `contracts-api`, you would see something similar to:

```bash
🦋  Which packages would you like to include? · @owlprotocol/contracts-api
🦋  Which packages should have a major bump? · No items were selected
🦋  Which packages should have a minor bump? · No items were selected
🦋  The following packages will be patch bumped:
🦋  @owlprotocol/<name>@<version>
```

Now commit the created `.changeset/[unique-changeset-name].md` as such:

```bash
git add . && git commit -m "add changeset"
```

### Consume Changeset
> Note: These can also be auto-consumed using the Github CI (merge to main)

After generating the changeset, we consume it to bump the versions and update the changelogs.

```bash
pnpm changeset version
```

You should see:

1. A deleted `.changeset/[unique-changeset-name].md`
2. Changes for `package.json` for any packages that were dependent.
3. New or updated `CHANGELOG.md` files for the above packages.

### Releasing changes

Publish the packages using `pnpm publish`

```bash
pnpm publish -r
```
