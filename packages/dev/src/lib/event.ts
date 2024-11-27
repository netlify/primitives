export interface DevEvent {
  name: string
}

export type DevEventHandler = (event: DevEvent) => void
