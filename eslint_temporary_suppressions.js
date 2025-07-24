/*
 * XXX: Temporary suppressions
 *
 * These rules are suppressed because we haven't yet fixed offending code.
 *
 * Want to help? Remove the suppression, fix any lint errors, and submit a PR.
 */

/** @type { import("eslint").Linter.Config[] } */
export default [
  /* Global rule suppressions */

  {
    ignores: ['**/*.test.?(c|m)[jt]s?(x)', '**/test/*', '**/tsup.config.ts'],
    rules: {
      'n/no-unsupported-features/node-builtins': [
        'error',
        {
          ignores: [
            // The Fetch API was technically marked stable in node 21, but for all intents and purposes
            // it's been stable since 18.
            'FormData',
            'Headers',
            'ReadableStream',
            'Response',
            'Request',
            'fetch',

            'Blob',
            'fs/promises.cp',
            'stream.Readable.toWeb',
          ],
        },
      ],
    },
  },

  /* Per-file rule suppressions */

  {
    files: ['packages/blobs/src/client.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  {
    files: ['packages/blobs/src/environment.ts'],
    rules: {
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
    },
  },
  {
    files: ['packages/blobs/src/main.test.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'vitest/valid-expect': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['packages/blobs/src/metadata.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
    },
  },
  {
    files: ['packages/blobs/src/retry.ts'],
    rules: {
      '@typescript-eslint/return-await': 'off',
    },
  },
  {
    files: ['packages/blobs/src/server.test.ts'],
    rules: {
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  {
    files: ['packages/blobs/src/server.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
    },
  },
  {
    files: ['packages/blobs/src/store.ts'],
    rules: {
      '@typescript-eslint/unified-signatures': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['packages/blobs/src/store_factory.ts'],
    rules: {
      '@typescript-eslint/unified-signatures': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  {
    files: ['packages/blobs/src/util.ts'],
    rules: {
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['packages/blobs/test/util.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['packages/cache/src/bootstrap/cache.test.ts'],
    rules: {
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
    },
  },
  {
    files: ['packages/cache/src/bootstrap/cache.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['packages/cache/src/bootstrap/environment.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['packages/cache/src/cache-headers/cache-headers.test.ts'],
    rules: {
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['packages/cache/src/cache-headers/cache-headers.ts'],
    rules: {
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['packages/cache/src/cache-headers/validation.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  {
    files: ['packages/cache/src/cache-status/cache-status.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/prefer-reduce-type-parameter': 'off',
      '@typescript-eslint/unified-signatures': 'off',
    },
  },
  {
    files: ['packages/cache/src/fetchwithcache.test.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      'vitest/valid-expect': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },
  {
    files: ['packages/cache/src/fetchwithcache.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/unified-signatures': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  {
    files: ['packages/cache/src/polyfill.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['packages/cache/src/test/util.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
    },
  },
  {
    files: ['packages/dev-utils/src/lib/api-token.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['packages/dev-utils/src/lib/base64.test.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['packages/dev-utils/src/lib/gitignore.ts'],
    rules: {
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['packages/dev-utils/src/lib/global-config.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-deprecated': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
  {
    files: ['packages/dev-utils/src/lib/local-state.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
  {
    files: ['packages/dev-utils/src/lib/memoize.ts'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
  {
    files: ['packages/dev-utils/src/lib/watch-debounced.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['packages/dev-utils/src/server/http_server.test.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['packages/dev-utils/src/server/http_server.ts'],
    rules: {
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['packages/dev-utils/src/test/event_inspector.ts'],
    rules: {
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['packages/dev-utils/src/test/fetch.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
    },
  },
  {
    files: ['packages/dev-utils/src/test/fixture.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['packages/dev/src/lib/env.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  {
    files: ['packages/dev/src/lib/runtime.ts'],
    rules: {
      '@typescript-eslint/no-dynamic-delete': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['packages/dev/src/main.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
  {
    files: ['packages/dev/test/mock-api.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  {
    files: ['packages/edge-functions/dev/node/main.test.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['packages/edge-functions/dev/node/main.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  {
    files: ['packages/edge-functions/src/version.test.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['packages/edge-functions/src/version.ts'],
    rules: {
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['packages/functions/dev/events.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
    },
  },
  {
    files: ['packages/functions/dev/function.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['packages/functions/dev/main.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  {
    files: ['packages/functions/dev/main.ts'],
    rules: {
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-misused-spread': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['packages/functions/dev/registry.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
    },
  },
  {
    files: ['packages/functions/dev/runtimes/index.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['packages/functions/dev/runtimes/nodejs/builder.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'n/no-missing-import': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
  {
    files: ['packages/functions/dev/runtimes/nodejs/config.ts'],
    rules: {
      '@typescript-eslint/prefer-reduce-type-parameter': 'off',
    },
  },
  {
    files: ['packages/functions/dev/runtimes/nodejs/index.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['packages/functions/dev/runtimes/nodejs/lambda.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['packages/functions/internal.d.ts'],
    rules: {
      'n/no-missing-import': 'off',
    },
  },
  {
    files: ['packages/functions/src/function/handler.ts'],
    rules: {
      '@typescript-eslint/prefer-function-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-invalid-void-type': 'off',
    },
  },
  {
    files: ['packages/functions/src/function/handler_context.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['packages/functions/src/function/handler_response.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['packages/functions/src/lib/builder.test.ts'],
    rules: {
      'n/no-missing-import': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'vitest/expect-expect': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['packages/functions/src/lib/builder.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
    },
  },
  {
    files: ['packages/functions/src/lib/purge_cache.test.ts'],
    rules: {
      'n/no-missing-import': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['packages/functions/src/lib/purge_cache.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
  {
    files: ['packages/functions/src/lib/schedule.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['packages/functions/src/lib/system_logger.test.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
  {
    files: ['packages/functions/src/lib/system_logger.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  {
    files: ['packages/functions/test/types/Handler.test-d.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['packages/images/src/main.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['packages/otel/src/bootstrap/main.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
    },
  },
  {
    files: ['packages/otel/src/exporters/netlify.ts'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['packages/otel/src/main.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['packages/redirects/src/lib/rewriter.ts'],
    rules: {
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
    },
  },
  {
    files: ['packages/redirects/src/main.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['packages/redirects/src/main.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  {
    files: ['packages/runtime-utils/src/lib/base64.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
  {
    files: ['packages/runtime-utils/src/main.test.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['packages/runtime/src/lib/environment/blobs.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['packages/runtime/src/lib/util.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['packages/runtime/src/main.test.ts'],
    rules: {
      '@typescript-eslint/no-dynamic-delete': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['packages/static/src/main.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['packages/types/src/lib/context/context.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['packages/types/src/main.test.ts'],
    rules: {
      'vitest/expect-expect': 'off',
      'vitest/valid-expect': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
  {
    files: ['packages/vite-plugin/src/lib/logger.ts'],
    rules: {
      '@typescript-eslint/no-confusing-void-expression': 'off',
    },
  },
  {
    files: ['packages/vite-plugin/src/main.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
]
