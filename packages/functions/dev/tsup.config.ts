import { argv } from 'node:process'

import { defineConfig } from 'tsup'

export default defineConfig({
  clean: true,
  outDir: 'dist',
  entry: ['src/main.ts'],
  format: ['esm'],
  dts: true,
  splitting: false,
  watch: argv.includes('--watch'),
  platform: 'node',
  bundle: true,
  publicDir: 'src/runtimes/nodejs',
})
