export { setEnvironmentContext } from './environment.ts'
export { connectLambda } from './lambda_compat.ts'
export { getDeployStore, getStore, type GetStoreOptions, type GetDeployStoreOptions } from './store_factory.ts'
export { listStores } from './store_list.ts'
export type {
  Store,
  StoreOptions,
  GetWithMetadataOptions,
  GetWithMetadataResult,
  ListOptions,
  ListResultBlob,
  SetOptions,
  BlobResponseType,
} from './store.ts'
