import { argv } from 'node:process'

import { defineConfig } from 'tsdown'

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
])
