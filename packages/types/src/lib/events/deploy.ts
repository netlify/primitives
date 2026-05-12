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

export type DeployBuildingEvent = DeployEvent
export type DeploySucceededEvent = DeployEvent
export type DeployFailedEvent = DeployEvent
export type DeployDeletedEvent = DeployEvent
export type DeployLockedEvent = DeployEvent
export type DeployUnlockedEvent = DeployEvent

export type DeployBuildingHandler = (event: DeployBuildingEvent) => void | Promise<void>
export type DeploySucceededHandler = (event: DeploySucceededEvent) => void | Promise<void>
export type DeployFailedHandler = (event: DeployFailedEvent) => void | Promise<void>
export type DeployDeletedHandler = (event: DeployDeletedEvent) => void | Promise<void>
export type DeployLockedHandler = (event: DeployLockedEvent) => void | Promise<void>
export type DeployUnlockedHandler = (event: DeployUnlockedEvent) => void | Promise<void>
