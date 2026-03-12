export interface DeployEventSite {
  id: string
  name: string
  url: string
  adminUrl: string
}

export interface DeployEvent {
  id: string
  siteId: string
  buildId: string | null
  state: string
  errorMessage: string | null
  url: string
  sslUrl: string
  deployUrl: string
  adminUrl: string
  context: string
  branch: string | null
  commitRef: string | null
  commitUrl: string | null
  commitMessage: string | null
  committer: string | null
  title: string | null
  createdAt: string
  publishedAt: string | null
  deployTime: number | null
  manualDeploy: boolean
  framework: string | null
  site: DeployEventSite
}
