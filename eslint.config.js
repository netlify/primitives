// @ts-check
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { includeIgnoreFile } from '@eslint/compat'
import eslint from '@eslint/js'
import node from 'eslint-plugin-n'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'
import vitest from '@vitest/eslint-plugin'

import temporarySuppressions from './eslint_temporary_suppressions.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const packagesPath = path.join(__dirname, 'packages')
const packages = await fs.readdir(packagesPath)
const packageIgnores = packages.map((name) => includeIgnoreFile(path.resolve(packagesPath, name, '.gitignore')))

export default tseslint.config(
  // Global rules and configuration
  includeIgnoreFile(path.resolve(__dirname, '.gitignore')),
  ...packageIgnores,
  {
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
  },

  // TODO: Move this to `edge-functions` package.
  {
    ignores: ['packages/**/deno', 'packages/edge-functions/bootstrap-bundle.mjs'],
  },

  // JavaScript-specific rules
  eslint.configs.recommended,

  // Typescript-specific rules
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.base.json', './packages/*/tsconfig.json'],
        tsconfigRootDir: __dirname,
      },
    },
  },

  {
    files: ['**/*.?(c|m)js?(x)'],
    ...tseslint.configs.disableTypeChecked,
  },
  node.configs['flat/recommended'],
  {
    rules: {
      'n/no-unpublished-import': 'off',
      'n/no-unpublished-require': 'off',
    },
  },

  // Project-specific rules
  {
    files: ['**/*.?(c|m)ts?(x)'],
    rules: {
      // `interface` and `type` have different use cases, allow both
      '@typescript-eslint/consistent-type-definitions': 'off',

      // Ignore underscore-prefixed unused variables (mirrors tsc behavior)
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
        },
      ],

      // Empty functions and blocks are useful (e.g `noop() {}`, `catch {}`) but can mask unintentionally omitted
      // implementation. We should add explanatory comments like `// intentionally empty` and `// ignore error` in these
      // scenarios to communicate intent.
      'no-empty': 'off',
      '@typescript-eslint/no-empty-function': 'off',
    },
  },

  // Tests
  {
    files: ['**/*.test.?(c|m)[jt]s?(x)', '**/test/*'],
    plugins: { vitest },
    rules: {
      ...vitest.configs.recommended.rules,

      'vitest/expect-expect': [
        'error',
        {
          assertFunctionNames: [
            // Defaults
            'assert',
            'expect',

            // Fix issue where text-context-specific `expect()` calls trigger false positive
            't.expect',
            'ctx.expect',
            'context.expect',

            // Custom assertion functions
            'assertNetlifyToml',
          ],
        },
      ],
      'n/no-unsupported-features/node-builtins': 'off',
    },
  },

  // Config files
  {
    files: ['**/tsup.config.ts'],
    rules: {
      'n/no-unsupported-features/node-builtins': 'off',
    },
  },

  ...temporarySuppressions,

  // Must be last
  prettier,
)
