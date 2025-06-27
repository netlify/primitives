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
    files: ['src/main.ts'],
    rules: {
      '@typescript-eslint/require-await': 'off',
    },
  },
]