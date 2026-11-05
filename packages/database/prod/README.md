# @netlify/database

[![@netlify/database version](https://npmx.dev/api/registry/badge/version/@netlify/database?color=28b5ac&name=true)](https://npmx.dev/package/@netlify/database)
[![license](https://npmx.dev/api/registry/badge/license/@netlify/database?color=28b5ac)](https://npmx.dev/package/@netlify/database)
[![node](https://npmx.dev/api/registry/badge/engines/@netlify/database?color=28b5ac)](https://npmx.dev/package/@netlify/database)
[![downloads/mo](https://npmx.dev/api/registry/badge/downloads/@netlify/database?color=28b5ac)](https://npmx.dev/package/@netlify/database)

Connect to [Netlify Database](https://docs.netlify.com/build/data-and-storage/netlify-database/) from your Netlify
project.

```shell
npm install @netlify/database
```

```ts
import { getDatabase } from '@netlify/database'

const { sql } = getDatabase()
const users = await sql`SELECT * FROM users`
```

The connection string is read from the `NETLIFY_DB_URL` environment variable, which Netlify sets for you.
