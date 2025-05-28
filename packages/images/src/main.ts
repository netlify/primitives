import { createIPX, createIPXWebServer, ipxFSStorage, ipxHttpStorage } from 'ipx'

interface ImagesConfig {
  remote_images: string[]
}

interface ImageHandlerOptions {
  imagesConfig?: ImagesConfig
}

export interface ImageMatch {
  handle: () => Promise<Response>
}

const IMAGE_CDN_ENDPOINTS = ['/.netlify/images', '/.netlify/images/']

interface IpxParams {
  w?: string | null
  h?: string | null
  s?: string | null
  quality?: string | null
  format?: string | null
  fit?: string | null
  position?: string | null
}

export class ImageHandler {
  private allowedRemoteUrlPatterns: RegExp[]

  constructor(options: ImageHandlerOptions) {
    // TODO: handle invalid patterns
    this.allowedRemoteUrlPatterns = (options.imagesConfig?.remote_images ?? []).map(
      (stringPattern) => new RegExp(stringPattern),
    )
  }

  private generateIPXRequestURL(imageURL: URL, netlifyImageCdnParams: URLSearchParams): URL {
    const params: IpxParams = {}

    const width = netlifyImageCdnParams.get('w') || netlifyImageCdnParams.get('width') || null
    const height = netlifyImageCdnParams.get('h') || netlifyImageCdnParams.get('height') || null

    if (width && height) {
      params.s = `${width}x${height}`
    } else {
      params.w = width
      params.h = height
    }

    params.quality = netlifyImageCdnParams.get('q') || netlifyImageCdnParams.get('quality') || null
    params.format = netlifyImageCdnParams.get('fm') || null

    const fit = netlifyImageCdnParams.get('fit') || null
    params.fit = fit === 'contain' ? 'inside' : fit

    params.position = netlifyImageCdnParams.get('position') || null

    const ipxModifiers = Object.entries(params)
      .filter(([, value]) => value !== null)
      .map(([key, value]) => `${key}_${value}`)
      .join(',')

    return new URL(`/${ipxModifiers || `_`}/${encodeURIComponent(imageURL.href)}`, imageURL.origin)
  }

  async match(request: Request): Promise<ImageMatch | undefined> {
    const url = new URL(request.url)

    if (IMAGE_CDN_ENDPOINTS.includes(url.pathname)) {
      return {
        handle: async () => {
          if (request.method !== 'GET') {
            return new Response('Method Not Allowed', { status: 405 })
          }

          const sourceImageUrlParam = url.searchParams.get('url')
          if (!sourceImageUrlParam) {
            return new Response('Bad Request: Missing "url" query parameter', { status: 400 })
          }

          const sourceImageUrl = new URL(sourceImageUrlParam, url.origin)

          // if it's not local image, check if it it's allowed
          if (
            sourceImageUrl.origin !== url.origin &&
            !this.allowedRemoteUrlPatterns.some((allowedRemoteUrlPattern) =>
              allowedRemoteUrlPattern.test(sourceImageUrl.href),
            )
          ) {
            return new Response('Forbidden: Remote image URL not allowed', { status: 403 })
          }

          const ipx = createIPX({
            storage: ipxFSStorage(),
            httpStorage: ipxHttpStorage({
              allowAllDomains: true,
            }),
          })

          const ipxHandler = createIPXWebServer(ipx)

          const ipxRequest = new Request(this.generateIPXRequestURL(sourceImageUrl, url.searchParams), request)
          return ipxHandler(ipxRequest)
        },
      }
    }
  }
}
