import { SandboxError } from './error.js'
import type { SandboxRawRequest } from './request.js'

interface FileOptions {
  /** Cancels the request. */
  signal?: AbortSignal
}

export interface WriteFileOptions extends FileOptions {
  /**
   * The file's permissions, like `0o755`. A file that already exists keeps
   * its own when this is left out, and a new one gets `0o644`.
   */
  mode?: number
}

export interface RemoveFileOptions extends FileOptions {
  /** Removes a directory together with everything in it. */
  recursive?: boolean
}

/** What can be written to a file. */
export type FileContents = string | Uint8Array | ArrayBuffer | Blob | ReadableStream<Uint8Array>

/** A file or a directory in the sandbox. */
export interface FileEntry {
  /** The entry's name within its directory. */
  name: string

  /** What the entry is. A symbolic link in a listing is not followed. */
  type: 'file' | 'directory' | 'symlink' | 'other'

  /** The size of a file, in bytes. */
  size: number

  /** The entry's permissions, like `0o644`. */
  mode: number

  /** When the entry's contents last changed. */
  modifiedAt: Date
}

interface FileEntryPayload {
  name: string
  type: FileEntry['type']
  size: number
  mode: string
  modified_at: string
}

/**
 * Files in the sandbox. A relative path starts from the directory commands
 * run in, which is `/root`.
 */
export interface Files {
  /** Reads a file as text. */
  read(path: string, options?: FileOptions): Promise<string>

  /** Reads a file as bytes. */
  readBytes(path: string, options?: FileOptions): Promise<Uint8Array>

  /** Reads a file as a stream. */
  stream(path: string, options?: FileOptions): Promise<ReadableStream<Uint8Array>>

  /**
   * Writes a file, replacing the one that is there and creating the
   * directories above it.
   */
  write(path: string, contents: FileContents, options?: WriteFileOptions): Promise<void>

  /** Lists what a directory holds, sorted by name. */
  list(path?: string, options?: FileOptions): Promise<FileEntry[]>

  /** Describes a file or a directory, following a symbolic link to what it points to. */
  stat(path: string, options?: FileOptions): Promise<FileEntry>

  /** Whether there is a file or a directory at the path. */
  exists(path: string, options?: FileOptions): Promise<boolean>

  /** Removes a file or an empty directory. */
  remove(path: string, options?: RemoveFileOptions): Promise<void>
}

// Statuses that mean the file operation itself failed, like reading a
// directory as a file (409) or writing to a full disk (507).
const FILE_ERROR_STATUSES = new Set([409, 507])

const toFileError = (error: unknown) => {
  if (error instanceof SandboxError && error.status !== undefined && FILE_ERROR_STATUSES.has(error.status)) {
    return new SandboxError('file_error', error.message, { status: error.status, requestID: error.requestID })
  }

  return error
}

const toEntry = (payload: FileEntryPayload): FileEntry => ({
  name: payload.name,
  type: payload.type,
  size: payload.size,
  mode: Number.parseInt(payload.mode, 8),
  modifiedAt: new Date(payload.modified_at),
})

export const createFiles = (request: SandboxRawRequest): Files => {
  const call = async (route: string, query: Record<string, string>, options: Parameters<SandboxRawRequest>[1]) => {
    try {
      return await request(`${route}?${new URLSearchParams(query).toString()}`, options)
    } catch (error) {
      throw toFileError(error)
    }
  }

  const files: Files = {
    async read(path, options = {}) {
      const response = await call('/files', { path }, { signal: options.signal })

      return response.text()
    },

    async readBytes(path, options = {}) {
      const response = await call('/files', { path }, { signal: options.signal })

      return new Uint8Array(await response.arrayBuffer())
    },

    async stream(path, options = {}) {
      const response = await call('/files', { path }, { signal: options.signal })

      return response.body ?? new ReadableStream<Uint8Array>({ start: (controller) => controller.close() })
    },

    async write(path, contents, options = {}) {
      const query: Record<string, string> = { path }

      if (options.mode !== undefined) {
        query.mode = options.mode.toString(8)
      }

      const response = await call('/files', query, {
        method: 'PUT',
        headers: { 'content-type': 'application/octet-stream' },
        body: contents as BodyInit,
        signal: options.signal,
      })

      await response.body?.cancel()
    },

    async list(path = '/', options = {}) {
      const response = await call('/files/entries', { path }, { signal: options.signal })
      const { entries } = (await response.json()) as { entries: FileEntryPayload[] }

      return entries.map(toEntry)
    },

    async stat(path, options = {}) {
      const response = await call('/files/info', { path }, { signal: options.signal })

      return toEntry((await response.json()) as FileEntryPayload)
    },

    async exists(path, options = {}) {
      try {
        await files.stat(path, options)

        return true
      } catch (error) {
        if (error instanceof SandboxError && error.code === 'not_found') {
          return false
        }

        throw error
      }
    },

    async remove(path, options = {}) {
      const query: Record<string, string> = { path }

      if (options.recursive) {
        query.recursive = 'true'
      }

      const response = await call('/files', query, { method: 'DELETE', signal: options.signal })

      await response.body?.cancel()
    },
  }

  return files
}
