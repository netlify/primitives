import * as esbuild from 'npm:esbuild'
import { denoPlugins } from 'jsr:@luca/esbuild-deno-loader@^0.11.1'

const [entryPoint, outfile] = Deno.args

await esbuild.build({
  bundle: true,
  entryPoints: [entryPoint],
  format: 'esm',
  minify: true,
  outfile,
  plugins: denoPlugins(),
})

await esbuild.stop()
