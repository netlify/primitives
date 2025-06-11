import { argv } from 'node:process'

import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    clean: true,
    entry: ['src/main.ts', 'src/internal.ts'],
    outDir: 'dist',
    format: ['cjs', 'esm'],
    dts: true,
    watch: argv.includes('--watch'),
    platform: 'node',
  },
  {
    clean: true,
    outDir: 'dist-dev',
    entry: ['dev/main.ts'],
    format: ['esm'],
    dts: true,
    watch: argv.includes('--watch'),
    platform: 'node',
    copy: 'dev/runtimes/nodejs',
  },
])
