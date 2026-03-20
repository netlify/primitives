[![Build](https://github.com/netlify/primitives/workflows/Build/badge.svg)](https://github.com/netlify/primitives/actions)
[![Node](https://img.shields.io/node/v/@netlify/aws-lambda-compat.svg?logo=node.js)](https://www.npmjs.com/package/@netlify/aws-lambda-compat)

# @netlify/aws-lambda-compat

AWS Lambda compatibility wrapper for Netlify Functions. Lets you author Netlify Functions using the AWS Lambda handler
signature.

## Installation

```shell
npm install @netlify/aws-lambda-compat
```

## Usage

Wrap your Lambda-style handler with `withLambda` and export the result as your Netlify Function:

```ts
import { withLambda } from '@netlify/aws-lambda-compat'
import type { HandlerEvent, HandlerContext, HandlerResponse } from '@netlify/aws-lambda-compat'

export default withLambda(async (event: HandlerEvent, context: HandlerContext): Promise<HandlerResponse> => {
  const name = event.queryStringParameters?.name ?? 'World'

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: `Hello, ${name}!` }),
  }
})
```

## How it works

`withLambda` converts between the two function signatures:

1. Incoming `Request` is converted to a Lambda `HandlerEvent` (URL, headers, query string, body with automatic base64
   encoding for binary payloads)
2. The Netlify `Context` is mapped to a `HandlerContext` with sensible defaults for AWS-specific fields
3. The `HandlerResponse` returned by your handler is converted back to a web-standard `Response`

## TypeScript types

The following types are re-exported from `@netlify/functions` for convenience:

- `Handler`
- `HandlerCallback`
- `HandlerContext`
- `HandlerEvent`
- `HandlerResponse`

Additionally, the package exports:

- `LambdaHandler` — the type of the handler function passed to `withLambda`

## Contributors

Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for instructions on how to set up and work on this repository.
Thanks for contributing!
