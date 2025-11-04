import process from 'node:process'

import type { Handler } from '@netlify/dev-utils'

import type { Redirect } from './lib/redirect.js'
import { type Rewriter, createRewriter } from './lib/rewriter.js'
import { signRedirect } from './lib/signer.js'

interface RedirectsMatch {
  error?: Error
  external: boolean
  force: boolean
  headers: Record<string, string>
  hiddenProxy: boolean
  redirect: boolean
  statusCode: number
  target: URL
  targetRelative: string
}

interface RedirectsHandlerOptions {
  configPath?: string | undefined
  configRedirects: Redirect[]
  geoCountry?: string | undefined
  jwtRoleClaim: string
  jwtSecret: string
  notFoundHandler?: Handler
  projectDir: string
  publicDir?: string | undefined
  siteID?: string
  siteURL?: string
}

type GetStaticFile = (request: Request) => Promise<(() => Promise<Response>) | undefined>

export class RedirectsHandler {
  private notFoundHandler: Handler
  private rewriter: Promise<Rewriter>
  private siteID: string
  private siteURL: string

  constructor({
    configPath,
    configRedirects,
    geoCountry,
    jwtRoleClaim,
    jwtSecret,
    notFoundHandler,
    projectDir,
    publicDir,
    siteID,
    siteURL,
  }: RedirectsHandlerOptions) {
    this.notFoundHandler = notFoundHandler ?? (() => Promise.resolve(new Response('Not found', { status: 404 })))
    this.rewriter = createRewriter({
      configPath,
      configRedirects,
      geoCountry,
      ignoreSPARedirect: true,
      jwtRoleClaim,
      jwtSecret,
      projectDir,
      publicDir,
    })
    this.siteID = siteID ?? '0'
    this.siteURL = siteURL ?? 'http://localhost'
  }

  async match(request: Request): Promise<RedirectsMatch | undefined> {
    const rewriter = await this.rewriter
    const rule = await rewriter(request)

    if (!rule) {
      return
    }

    if (rule.force404) {
      return {
        external: false,
        force: true,
        headers: {},
        hiddenProxy: false,
        redirect: false,
        statusCode: 404,
        target: new URL(''),
        targetRelative: '',
      }
    }

    const requestURL = new URL(request.url)
    const headers = {
      ...(rule.force404 ? {} : rule.proxyHeaders),
    }
    const hiddenProxy = Object.entries(headers).some(
      ([key, val]) => key.toLowerCase() === 'x-nf-hidden-proxy' && val === 'true',
    )
    const target = new URL(rule.to, request.url)
    const match: RedirectsMatch = {
      external: 'to' in rule && /^https?:\/\//.exec(rule.to) != null,
      force: rule.force,
      headers,
      hiddenProxy,
      redirect: 'status' in rule && rule.status != null && rule.status >= 300 && rule.status <= 400,
      statusCode: rule.status,
      target,
      targetRelative: `${rule.to}${requestURL.search}${requestURL.hash}`,
    }

    if (target.searchParams.size === 0) {
      requestURL.searchParams.forEach((val, key) => {
        target.searchParams.append(key, val)
      })
    }

    if (rule.signingSecret) {
      const signingSecretVar = process.env[rule.signingSecret]

      if (signingSecretVar) {
        match.headers['x-nf-sign'] = signRedirect({
          deployContext: 'dev',
          secret: signingSecretVar,
          siteID: this.siteID,
          siteURL: this.siteURL,
        })
      } else {
        match.error = new Error(`Could not sign redirect because environment variable ${rule.signingSecret} is not set`)
      }
    }

    return match
  }

  async handle(request: Request, match: RedirectsMatch, getStaticFile: GetStaticFile) {
    if (match.force && match.statusCode === 404) {
      return this.notFoundHandler(request)
    }

    const sourceStaticFile = await getStaticFile(request)
    if (sourceStaticFile && !match.force) {
      return sourceStaticFile()
    }

    if (match.redirect) {
      return Response.redirect(match.target, match.statusCode)
    }

    if (match.external) {
      const req = new Request(match.target, request)

      return fetch(req)
    }

    const targetStaticFile = await getStaticFile(new Request(match.target, request))
    if (targetStaticFile) {
      return targetStaticFile()
    }
  }
}
