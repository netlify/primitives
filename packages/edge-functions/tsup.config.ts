import { argv } from 'node:process'

import { defineConfig } from 'tsup'

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
    outDir: 'dist-dev',
    entry: ['dev/node/main.ts'],
    format: ['esm'],
    dts: true,
    splitting: false,
    watch: argv.includes('--watch'),
    platform: 'node',
    bundle: true,
  },
])
