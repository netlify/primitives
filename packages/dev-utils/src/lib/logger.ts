import ansis from 'ansis'

type logFunction = (message?: string) => void

export type Logger = {
  error: logFunction
  log: logFunction
  warn: logFunction
}

export const netlifyCommand = ansis.cyanBright

export const netlifyCyan = ansis.rgb(40, 180, 170)

export const netlifyBanner = netlifyCyan('⬥ Netlify')
