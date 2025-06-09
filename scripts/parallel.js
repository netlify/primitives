import { execaCommand as run } from 'execa'
import pkg from '../package.json' with { type: 'json' }
import { createInterface } from 'node:readline'

const args = process.argv.slice(2)
if (!args.length) {
  console.error('Usage: npm run parallel <command>')
  throw new Error('No command provided')
}
const cmd = args.join(' ')
const FORCE_COLOR = ['0', 'false', ''].includes(/** @type {string} */ (process.env.FORCE_COLOR)) ? undefined : '1'
await Promise.all(
  pkg.workspaces.map((cwd, index) => {
    const name = cwd.split('/').pop()
    const actor = run(cmd, {
      cwd,
      shell: true,
      env: { ...process.env, FORCE_COLOR },
    })
    if (!actor.stdout || !actor.stderr) {
      throw new Error(`No stdout or stderr for ${name} in ${cwd}`)
    }
    const color = `\x1b[${31 + (index % 6)}m`
    const reset = '\x1b[0m'
    const prefix = `${color}[${name}]${reset} `

    createInterface({ input: actor.stdout }).on('line', (line) => {
      process.stdout.write(`${prefix}${line}\n`)
    })
    createInterface({ input: actor.stderr }).on('line', (line) => {
      process.stderr.write(`${prefix}${line}\n`)
    })

    return actor
  }),
)
