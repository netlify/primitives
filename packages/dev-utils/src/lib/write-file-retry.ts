import { platform } from 'node:os'

import { sync as writeFileAtomicSync } from 'write-file-atomic'

const MAX_WRITE_RETRIES = 5
const RETRY_DELAY_MS = 100

/**
 * Wraps writeFileAtomicSync with retry logic for Windows EPERM errors.
 * On Windows, atomic file operations can fail with EPERM due to antivirus,
 * Windows Search indexer, or other processes holding transient file locks.
 */
export const writeFileAtomicWithRetry = (filePath: string, data: string, options: { mode: number }) => {
  let lastError: Error | undefined

  for (let attempt = 0; attempt < MAX_WRITE_RETRIES; attempt++) {
    try {
      writeFileAtomicSync(filePath, data, options)
      return
    } catch (err) {
      lastError = err as Error

      if (platform() === 'win32' && err instanceof Error && 'code' in err && err.code === 'EPERM') {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt)
        const start = Date.now()
        while (Date.now() - start < delay) {
          // Synchronous sleep for sync function
        }
        continue
      }
      throw err
    }
  }

  throw lastError
}
