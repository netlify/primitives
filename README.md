# Netlify Primitives

> [!IMPORTANT]  
> This is a proof-of-concept. Don't use in production! For more background, see
> [this Notion document](https://www.notion.so/netlify/Imagining-a-new-Netlify-CLI-0d1e8a0e5a3f4b579e2df1d59cb20376).

A monorepo containing the runtime and local development components of different Netlify platform primitives.

## Local development

This monorepo uses [npm workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces/).

Start by installing the dependencies:

```sh
npm install
```

You can then build all the packages:

```sh
npm run build -ws
```
