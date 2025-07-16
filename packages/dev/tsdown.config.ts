import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    clean: true,
    entry: ['src/main.ts'],
    outDir: 'dist',
    format: ['cjs', 'esm'],
    dts: true,
    platform: 'node',
  },
])
