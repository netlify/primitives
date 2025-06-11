import { argv } from 'node:process'

import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    clean: true,
    entry: ['src/main.ts'],
    outDir: 'dist',
    format: ['esm'],
    dts: true,
    watch: argv.includes('--watch'),
    platform: 'node',
    bundle: true,
  },
])
