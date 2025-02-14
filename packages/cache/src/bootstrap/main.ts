import { Factory } from './environment.ts'

export type TokenFactory = Factory<string>
export type URLFactory = Factory<string>
export { NetlifyCache } from './cache.ts'
export { NetlifyCacheStorage } from './cachestorage.ts'
