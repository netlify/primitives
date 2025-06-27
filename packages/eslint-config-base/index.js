// @ts-check
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { includeIgnoreFile } from '@eslint/compat'
import eslint from '@eslint/js'
import node from 'eslint-plugin-n'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'
import vitest from '@vitest/eslint-plugin'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export function createBaseConfig(packageDir) {
  const gitignorePath = path.resolve(packageDir, '.gitignore')
  
  return tseslint.config(
    // Global rules and configuration
    includeIgnoreFile(gitignorePath),
    {
      linterOptions: {
        reportUnusedDisableDirectives: true,
      },
    },

    // JavaScript-specific rules
    eslint.configs.recommended,

    // Typescript-specific rules
    tseslint.configs.strictTypeChecked,
    tseslint.configs.stylisticTypeChecked,
    {
      files: ['src/**/*.?(c|m)ts?(x)'],
      languageOptions: {
        parserOptions: {
          project: path.join(packageDir, 'tsconfig.json'),
          tsconfigRootDir: packageDir,
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
        '@typescript-eslint/consistent-type-definitions': 'off',
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
              'assert',
              'expect',
              't.expect',
              'ctx.expect',
              'context.expect',
              'assertNetlifyToml',
            ],
          },
        ],
        'n/no-unsupported-features/node-builtins': 'off',
      },
    },

    // Config files - disable type checking since they're not in tsconfig
    {
      files: ['**/tsup.config.ts', '**/vitest.config.ts', '**/*.d.ts'],
      ...tseslint.configs.disableTypeChecked,
      rules: {
        'n/no-unsupported-features/node-builtins': 'off',
      },
    },

    // Global suppressions for Fetch API
    {
      ignores: ['**/*.test.?(c|m)[jt]s?(x)', '**/test/*', '**/tsup.config.ts'],
      rules: {
        'n/no-unsupported-features/node-builtins': [
          'error',
          {
            ignores: [
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

    // Must be last
    prettier,
  )
}