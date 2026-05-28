import { expectAssignable, expectError } from 'tsd'

import { NetlifyFunction } from '../../src/main.js'

// Regular fetch: must return Response.
expectAssignable<NetlifyFunction>({
  fetch: () => new Response('hi'),
  config: { path: '/hi' },
})

// Regular fetch: returning void is rejected.
expectError<NetlifyFunction>({
  fetch: () => {},
  config: { path: '/hi' },
})

// Background fetch: returning void is fine.
expectAssignable<NetlifyFunction>({
  fetch: () => {},
  config: { path: '/hi', background: true },
})

// Background fetch: returning Response is rejected (strict Option A — the
// runtime discards the response, so a Response return type is misleading).
expectError<NetlifyFunction>({
  fetch: () => new Response('hi'),
  config: { path: '/hi', background: true },
})

// Async background fetch returning Promise<void> is fine.
expectAssignable<NetlifyFunction>({
  fetch: async () => {},
  config: { path: '/hi', background: true },
})

// `background: false` keeps the regular fetch contract.
expectAssignable<NetlifyFunction>({
  fetch: () => new Response('hi'),
  config: { path: '/hi', background: false },
})

// Function with no config still requires Response from fetch.
expectAssignable<NetlifyFunction>({
  fetch: () => new Response('hi'),
})

// Event handlers coexist with either variant.
expectAssignable<NetlifyFunction>({
  fetch: () => new Response('hi'),
  deploySucceeded: () => {},
  config: { path: '/hi' },
})
expectAssignable<NetlifyFunction>({
  fetch: () => {},
  deploySucceeded: () => {},
  config: { path: '/hi', background: true },
})
