export interface DeploySite {
  id: string
  name: string
  url: string
  adminUrl: string
}

export interface Deploy {
  id: string
  siteId: string
  buildId: string | null
  state: string
  errorMessage: string | null
  url: string
  sslUrl: string
  permalinkUrl: string
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
  time: number | null
  manual: boolean
  framework: string | null
}

export interface DeployEvent {
  deploy: Deploy
  site: DeploySite
}
