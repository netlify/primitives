# ![functions](functions.png)

[![@netlify/functions version](https://npmx.dev/api/registry/badge/version/@netlify/functions?color=28b5ac&name=true)](https://npmx.dev/package/@netlify/functions)
[![license](https://npmx.dev/api/registry/badge/license/@netlify/functions?color=28b5ac)](https://npmx.dev/package/@netlify/functions)
[![node](https://npmx.dev/api/registry/badge/engines/@netlify/functions?color=28b5ac)](https://npmx.dev/package/@netlify/functions)
[![downloads/mo](https://npmx.dev/api/registry/badge/downloads/@netlify/functions?color=28b5ac)](https://npmx.dev/package/@netlify/functions)

JavaScript and TypeScript utilities for [Netlify Functions](https://docs.netlify.com/functions/overview/).

## Installation

```
npm install @netlify/functions
```

## Usage

### On-demand Builders

To use On-demand Builders, wrap your function handler with the `builder` function.

- With JavaScript:

  ```js
  const { builder } = require('@netlify/functions')

  const handler = async (event, context) => {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Hello World' }),
    }
  }

  exports.handler = builder(handler)
  ```

- With TypeScript:

  ```ts
  import { builder, Handler } from '@netlify/functions'

  const myHandler: Handler = async (event, context) => {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Hello World' }),
    }
  }

  const handler = builder(myHandler)

  export { handler }
  ```

### Scheduled Functions (currently in beta)

To use Scheduled Functions, wrap your function handler with the `schedule` function.

- With JavaScript:

  ```js
  const { schedule } = require('@netlify/functions')

  exports.handler = schedule('5 4 * * *', async () => {
    console.log("It's 04:05 AM!")
  })
  ```

- With TypeScript:

  ```ts
  import { schedule } from '@netlify/functions'

  export const handler = schedule('5 4 * * *', async () => {
    console.log("It's 04:05 AM!")
  })
  ```

### TypeScript typings

This module exports typings for authoring Netlify Functions in TypeScript.

```ts
import { Handler } from '@netlify/functions'

const handler: Handler = async (event, context) => {
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello World' }),
  }
}

export { handler }
```

The following types are exported:

- `Handler`
- `HandlerCallback`
- `HandlerContext`
- `HandlerEvent`
- `HandlerResponse`

## Contributors

Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for instructions on how to set up and work on this repository. Thanks
for contributing!
