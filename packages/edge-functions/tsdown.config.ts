import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { argv } from 'node:process'

import { getURL } from '@netlify/edge-functions-bootstrap/version'
import { execa } from 'execa'
import { defineConfig } from 'tsdown'

const __filename = fileURLToPath(import.meta.url)

const BOOTSTRAP_FILENAME = 'bootstrap.mjs'

export default defineConfig([
  {
    clean: true,
    format: ['esm'],
    entry: ['src/main.ts'],
    tsconfig: 'tsconfig.json',
    dts: true,
    outDir: './dist',
    watch: argv.includes('--watch'),
  },
  {
    clean: true,
    format: ['esm'],
    entry: ['src/version.ts'],
    tsconfig: 'tsconfig.json',
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
    watch: argv.includes('--watch'),
    platform: 'node',


    // Using a custom function to copy the contents of the `deno` directory and
    // preserve the original structure, so that the relative path to the worker
    // files is consistent.
    onSuccess: async () => {
      const bootstrapURL = await getURL()
      const denoPath = path.resolve(path.dirname(__filename), 'dev', 'deno')
      const distPath = path.resolve(path.dirname(__filename), 'dist-dev')

      await fs.cp(denoPath, path.resolve(distPath, 'deno'), { recursive: true })

      // We need to bundle the bootstrap layer with the package because Deno
      // does not support HTTP imports when inside a `node_modules` directory.
      const distBootstrapPath = path.resolve(distPath, 'deno', BOOTSTRAP_FILENAME)
      await execa(
        'deno',
        ['run', '--allow-all', '--no-lock', 'bootstrap-bundle.mjs', bootstrapURL, distBootstrapPath],
        {
          stdio: 'inherit',
        },
      )

      // In addition to putting the bootstrap file in `dist-dev`, we must also
      // put it in the source directory so that the reference to the bootstrap
      // file still works in tests and local development. This is not great. At
      // least we're gitignoring the file so that it doesn't end up in version
      // control.
      await fs.cp(distBootstrapPath, path.resolve(denoPath, BOOTSTRAP_FILENAME))
    },
  },
])
