import chalk from 'chalk'

const NETLIFY_CYAN = chalk.rgb(40, 180, 170)
const banner = NETLIFY_CYAN('⬥ Netlify ⬥')

export const logger = {
  error: (...data: any[]) => (data.length === 0 ? console.error(...data) : console.error(banner, ...data)),
  log: (...data: any[]) => (data.length === 0 ? console.log(...data) : console.log(banner, ...data)),
  warn: (...data: any[]) => (data.length === 0 ? console.warn(...data) : console.warn(banner, ...data)),
}
