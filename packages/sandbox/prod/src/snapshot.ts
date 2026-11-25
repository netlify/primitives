import type { Client } from './client.js'
import type { SnapshotPayload } from './types.js'

/** A saved copy of a sandbox's disk that new sandboxes can start from. */
export class Snapshot {
  /** The snapshot's ID. */
  readonly id: string

  /** The ID of the site the snapshot belongs to. */
  readonly siteID: string

  /** The size of the disk the snapshot holds, in megabytes. */
  readonly diskSize: number

  /** When the snapshot was taken. */
  readonly createdAt: Date

  /** When the snapshot was last used, which includes creating a sandbox from it. */
  readonly lastUsedAt: Date

  /** When the snapshot expires if no sandbox is created from it before then. */
  readonly expiresAt: Date | undefined

  readonly #client: Client

  constructor(payload: SnapshotPayload, client: Client) {
    this.id = payload.id
    this.siteID = payload.site_id
    this.diskSize = payload.disk_size_mb
    this.createdAt = new Date(payload.created_at)
    this.lastUsedAt = new Date(payload.last_used_at)
    this.expiresAt = payload.expires_at === undefined ? undefined : new Date(payload.expires_at)

    this.#client = client
  }

  /** Deletes the snapshot. Sandboxes created from it keep their disks. */
  async delete(options: { signal?: AbortSignal } = {}): Promise<void> {
    await this.#client.deleteSnapshot(this.id, options)
  }
}
