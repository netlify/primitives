/** One hidden environment variable, and where its real value may be sent. */
export interface SecretBinding {
  /** The environment variable holding the secret. */
  env: string

  /** Hostnames the secret may be sent to. `*.example.com` covers subdomains. */
  hosts: string[]

  /** When set, limits the secret to these request methods. */
  methods?: string[]

  /** When set, limits the secret to paths starting with one of these. */
  paths?: string[]
}

export interface NetworkPolicy {
  /**
   * `allowlist` admits only what is listed in `allow`, `deny_all` blocks
   * everything, `allow_all` (the default) allows everything.
   */
  egress?: 'allowlist' | 'deny_all' | 'allow_all'

  /** Hostnames the allowlist admits. `*.example.com` covers subdomains. */
  allow?: string[]

  /**
   * Environment variables to hide from the sandbox. It sees a placeholder, and
   * the real value is put back only on calls to the configured hosts and paths.
   */
  secrets?: SecretBinding[]
}

export interface SandboxPayload {
  id: string
  site_id: string
  hostname: string
  memory_mb: number
  vcpus: number
  disk_size_mb: number
  created_at: string
}

export interface SnapshotPayload {
  id: string
  site_id: string
  disk_size_mb: number
  created_at: string
  last_used_at: string
  expires_at?: string
}
