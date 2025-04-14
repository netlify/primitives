import getGlobalConfigStore from './global-config.js'

export const getAPIToken = async () => {
  const globalConfig = await getGlobalConfigStore()
  const userId = globalConfig.get('userId')
  const token = globalConfig.get(`users.${userId}.auth.token`) as string | undefined

  return token
}
