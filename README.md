# Netlify Primitives

> [!IMPORTANT]  
> This is a proof-of-concept, not yet ready for production use.

This is a monorepo containing the various Netlify platform primitives as self-contained packages. Each package contains all the logic required to interact with the primitive at runtime, but also all the scaffolding needed to run the primitive in local development.

Currently, the local development logic for all primitives lives inside the CLI monolith, which makes them impossible to interact with when not using the CLI (e.g. when using a framework through Vite). Also, it makes the CLI itself complex and therefore harder to iterate on.

By moving the different primitives into self-contained, composable packages, we can start paving the way for a modular CLI and different entry points into our platform, as described in [the "Imagining a new Netlify CLI" document](https://www.notion.so/netlify/Imagining-a-new-Netlify-CLI-0d1e8a0e5a3f4b579e2df1d59cb20376).

For a concrete example of what this allows, check out [this test](packages/functions/src/dev/middleware.test.ts).
