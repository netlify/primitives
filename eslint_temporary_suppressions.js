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
    rules: {
      // Empty functions and blocks are useful (e.g `noop() {}`, `catch {}`) but can mask unintentionally omitted
      // implementation. We should add explanatory comments like `// intentionally empty` and `// ignore error` in these
      // scenarios to communicate intent.
      'no-empty': 'off',
      '@typescript-eslint/no-empty-function': 'off',

      // We use these globals even though they're technically unstable features on our minimum
      // supported node version.
      'n/no-unsupported-features/node-builtins': [
        'error',
        {
          ignores: [
            'Blob',
            'fetch',
            'Headers',
            'ReadableStream',
            'Request',
            'Response',
            'stream.Readable.fromWeb',
            'stream.Readable.toWeb',
            'stream/web',
          ],
        },
      ],

      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/consistent-indexed-object-style': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-deprecated': 'off',
      '@typescript-eslint/no-dynamic-delete': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-invalid-void-type': 'off',
      '@typescript-eslint/no-misused-promises': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-unnecessary-type-arguments': 'off',
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      '@typescript-eslint/prefer-function-type': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/prefer-optional-chain': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      '@typescript-eslint/prefer-reduce-type-parameter': 'off',
      '@typescript-eslint/prefer-regexp-exec': 'off',
      '@typescript-eslint/prefer-string-starts-ends-with': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/restrict-plus-operands': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/return-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/unified-signatures': 'off',
      'vitest/expect-expect': 'off',
      'vitest/valid-expect': 'off',
    },
  },

  /* Per-file rule suppressions */
  {
    files: ['packages/cache/src/fetchwithcache.test.ts'],
    rules: {
      'prefer-const': 'off',
    },
  },
  {
    files: ['packages/functions/dev/main.ts'],
    rules: {
      '@typescript-eslint/no-misused-spread': 'off',
    },
  },
  {
    files: ['packages/dev-utils/src/lib/watch-debounced.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },
]
