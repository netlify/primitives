import { type ClientOptions, Client } from './client.js'
import type { Snapshot } from './snapshot.js'

export interface SnapshotsOptions extends ClientOptions {
  signal?: AbortSignal
}

/** Lists the site's snapshots, newest first. */
export const listSnapshots = ({ signal, ...options }: SnapshotsOptions = {}): Promise<Snapshot[]> =>
  new Client(options).listSnapshots({ signal })

/** Deletes a snapshot by its ID. Sandboxes created from it keep their disks. */
export const deleteSnapshot = (id: string, { signal, ...options }: SnapshotsOptions = {}): Promise<void> =>
  new Client(options).deleteSnapshot(id, { signal })
