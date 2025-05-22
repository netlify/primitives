interface HeadersHandlerOptions {
  configPath?: string | undefined
  geoCountry?: string | undefined
  jwtRoleClaim: string
  jwtSecret: string
  projectDir: string
  publicDir?: string | undefined
  siteID?: string
  siteURL?: string
}

export class HeadersHandler {
  private siteID: string
  private siteURL: string

  constructor({ configPath, geoCountry, projectDir, publicDir, siteID, siteURL }: HeadersHandlerOptions) {
    this.siteID = siteID ?? '0'
    this.siteURL = siteURL ?? 'http://localhost'
  }

  async match(_request: Request): Promise<undefined> {
    return
  }

  async handle(_request: Request, response: Response) {
    return response
  }
}
