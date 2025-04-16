import { argv } from 'node:process'

import { defineConfig } from 'tsup'

export default defineConfig([
  {
    clean: true,
    entry: ['src/main.ts'],
    outDir: 'dist',
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    watch: argv.includes('--watch'),
    platform: 'node',
    bundle: true,
  },
  {
    clean: true,
    outDir: 'dist-dev',
    entry: ['dev/main.ts'],
    format: ['esm'],
    dts: true,
    splitting: false,
    watch: argv.includes('--watch'),
    platform: 'node',
    bundle: true,
    publicDir: 'dev/runtimes/nodejs',
  },
])
