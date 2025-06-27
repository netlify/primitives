import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    clean: true,
    entry: ['src/main.ts', 'src/internal.ts'],
    outDir: 'dist',
    format: ['cjs', 'esm'],
    dts: true,
    platform: 'node',
  },
  {
    clean: true,
    outDir: 'dist-dev',
    entry: ['dev/main.ts'],
    format: ['esm'],
    dts: true,
    platform: 'node',
    copy: {
      from: 'dev/runtimes/nodejs',
      to: 'dist-dev',
    },
  },
])
