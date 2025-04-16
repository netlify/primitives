import { DevEvent } from '@netlify/dev-utils'

import type { NetlifyFunction } from './function.js'

export interface FunctionBuildErrorEvent extends DevEvent {
  error: Error | null
  function: NetlifyFunction
}

export interface FunctionExtractedEvent extends DevEvent {
  function: NetlifyFunction
}

export interface FunctionLoadedEvent extends DevEvent {
  firstLoad: boolean
  function: NetlifyFunction
}

export interface FunctionMissingTypesPackageEvent extends DevEvent {}

export interface FunctionNotInvokableOnPathEvent extends DevEvent {
  function: NetlifyFunction
  urlPath: string
}

export interface FunctionRegisteredEvent extends DevEvent {
  function: NetlifyFunction
}

export interface FunctionReloadingEvent extends DevEvent {
  function: NetlifyFunction
}

export interface FunctionRemovedEvent extends DevEvent {
  function: NetlifyFunction
}
