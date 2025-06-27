// @ts-check
import { fileURLToPath } from 'node:url'
import * as path from 'node:path'
import { createBaseConfig } from '@netlify/eslint-config-base'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const baseConfig = createBaseConfig(__dirname)

export default [
  ...baseConfig,
  
  // Package-specific suppressions
  {
    files: ['src/lib/context/context.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['src/main.test.ts'],
    rules: {
      'vitest/expect-expect': 'off',
      'vitest/valid-expect': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
]