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

export interface NetlifyFunction {
  fetch?: (req: Request, context: Context) => Response | Promise<Response>
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
  config?: Config
}
