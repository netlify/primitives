export class DevEvent {}

export type DevEventHandler = (event: DevEvent) => Promise<void>
