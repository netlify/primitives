import type { Context, Config } from './v2.js'
import type {
  DeployBuildingHandler,
  DeploySucceededHandler,
  DeployFailedHandler,
  DeployDeletedHandler,
  DeployLockedHandler,
  DeployUnlockedHandler,
  UserLoginHandler,
  UserSignupHandler,
  UserValidateHandler,
  UserModifiedHandler,
  UserDeletedHandler,
  FormSubmittedHandler,
} from '@netlify/types'

type FetchHandler = (req: Request, context: Context) => Response | Promise<Response>
type BackgroundFetchHandler = (req: Request, context: Context) => void | Promise<void>

interface BaseNetlifyFunction {
  deployBuilding?: DeployBuildingHandler
  deploySucceeded?: DeploySucceededHandler
  deployFailed?: DeployFailedHandler
  deployDeleted?: DeployDeletedHandler
  deployLocked?: DeployLockedHandler
  deployUnlocked?: DeployUnlockedHandler
  formSubmitted?: FormSubmittedHandler
  userLogin?: UserLoginHandler
  userSignup?: UserSignupHandler
  userValidate?: UserValidateHandler
  userModified?: UserModifiedHandler
  userDeleted?: UserDeletedHandler
}

// `config.background` discriminates between a regular `fetch` handler (must
// return `Response`) and a background one (response is discarded).
export type NetlifyFunction =
  | (BaseNetlifyFunction & {
      fetch?: FetchHandler
      config?: Config & { background?: false }
    })
  | (BaseNetlifyFunction & {
      fetch?: BackgroundFetchHandler
      config: Config & { background: true }
    })
