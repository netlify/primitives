import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { argv } from 'node:process'

import { defineConfig } from 'tsup'

const __filename = fileURLToPath(import.meta.url)

export default defineConfig([
  {
    clean: true,
    format: ['esm'],
    entry: ['src/main.ts'],
    tsconfig: 'tsconfig.json',
    splitting: false,
    bundle: true,
    dts: true,
    outDir: './dist',
    watch: argv.includes('--watch'),
  },
  {
    clean: true,
    format: ['esm'],
    entry: ['src/version.ts'],
    tsconfig: 'tsconfig.json',
    splitting: false,
    bundle: true,
    dts: true,
    outDir: './dist',
    watch: argv.includes('--watch'),
  },
  {
    clean: true,
    outDir: 'dist-dev/node',
    entry: ['dev/node/main.ts'],
    format: ['esm'],
    dts: true,
    splitting: false,
    watch: argv.includes('--watch'),
    platform: 'node',
    bundle: true,

    // Using a custom function to copy the contents of the `deno` directory and
    // preserve the original structure, so that the relative path to the worker
    // files is consistent.
    onSuccess: async () => {
      const denoPath = path.resolve(path.dirname(__filename), 'dev', 'deno')
      const distPath = path.resolve(path.dirname(__filename), 'dist-dev')

      await fs.cp(denoPath, path.resolve(distPath, 'deno'), { recursive: true })
    },
  },
])
