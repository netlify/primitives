import { platform } from 'node:os'

import type { ExecaChildProcess } from 'execa'
import { satisfies } from 'semver'

// 1 second
const SERVER_KILL_TIMEOUT = 1e3

export interface ProcessRef {
  ps?: ExecaChildProcess
}

export const killProcess = (ps?: ExecaChildProcess) => {
  // If the process is no longer running, there's nothing left to do.
  if (!ps || ps.exitCode !== null) {
    return
  }

  return new Promise<void>((resolve, reject) => {
    void ps.on('close', () => {
      resolve()
    })
    void ps.on('error', reject)

    // On Windows with Node 21+, there's a bug where attempting to kill a child process
    // results in an EPERM error. Ignore the error in that case.
    // See: https://github.com/nodejs/node/issues/51766
    // We also disable execa's `forceKillAfterTimeout` in this case
    // which can cause unhandled rejection.
    try {
      ps.kill('SIGTERM', {
        forceKillAfterTimeout: SERVER_KILL_TIMEOUT,
      })
    } catch {
      // no-op
    }
  })
}
