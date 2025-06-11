import { argv } from 'node:process'

import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    clean: true,
    entry: ['src/server.ts', 'src/main.ts'],
    tsconfig: 'tsconfig.json',
    format: ['cjs', 'esm'],
    dts: true,
    outDir: './dist',
    watch: argv.includes('--watch'),
  },
])
