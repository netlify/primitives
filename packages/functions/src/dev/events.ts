import path from 'node:path'

import { DevEvent } from '@netlify/dev'

import type { NetlifyFunction } from './function.js'

class FunctionEvent extends DevEvent {
  func: NetlifyFunction

  constructor(func: NetlifyFunction) {
    super()

    this.func = func
  }
}

export class FunctionBuildErrorEvent extends DevEvent {
  error: Error | null
  func: NetlifyFunction

  constructor(func: NetlifyFunction) {
    super()

    this.error = func.buildError
    this.func = func
  }
}

export class FunctionExtractedEvent extends FunctionEvent {}

export class FunctionLoadedEvent extends DevEvent {
  func: NetlifyFunction
  isLegacyCJS: boolean
  recommendedRename?: string

  constructor(func: NetlifyFunction) {
    super()

    this.func = func
    this.isLegacyCJS = false

    const recommendedExtension = func.getRecommendedExtension()

    if (recommendedExtension) {
      const { filename } = func

      if (filename) {
        this.recommendedRename = `${path.basename(filename, path.extname(filename))}${recommendedExtension}`
      }

      this.isLegacyCJS = true
    }
  }
}

export class FunctionMissingTypesPackageEvent extends DevEvent {}

export class FunctionNotInvokableOnPathEvent extends FunctionEvent {
  urlPath: string

  constructor(func: NetlifyFunction, urlPath: string) {
    super(func)

    this.urlPath = urlPath
  }
}

export class FunctionRegisteredEvent extends FunctionEvent {}

export class FunctionReloadedEvent extends FunctionLoadedEvent {}

export class FunctionReloadingEvent extends FunctionEvent {}

export class FunctionRemovedEvent extends FunctionEvent {}
