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

export class ImageHandler {
  private allowedRemoteUrlPatterns: RegExp[]

  constructor(options: ImageHandlerOptions) {
    // TODO: handle invalid patterns
    this.allowedRemoteUrlPatterns = (options.imagesConfig?.remote_images ?? []).map(
      (stringPattern) => new RegExp(stringPattern),
    )
  }

  private generateIPXRequestURL(imageURL: URL, netlifyImageCdnParams: URLSearchParams): URL {
    const ipxParams: string[] = []

    const width = netlifyImageCdnParams.get('w') ?? netlifyImageCdnParams.get('width')
    const height = netlifyImageCdnParams.get('h') ?? netlifyImageCdnParams.get('height')

    if (width && height) {
      ipxParams.push(`resize_${width}x${height}`)
    } else if (width) {
      ipxParams.push(`width_${width}`)
    } else if (height) {
      ipxParams.push(`height_${height}`)
    }

    const quality = netlifyImageCdnParams.get('q') ?? netlifyImageCdnParams.get('quality')
    if (quality) {
      ipxParams.push(`quality_${quality}`)
    }
    const format = netlifyImageCdnParams.get('fm')
    if (format) {
      ipxParams.push(`format_${format}`)
    }

    const fit = netlifyImageCdnParams.get('fit')
    if (fit) {
      ipxParams.push(`fit_${fit === 'contain' ? 'inside' : fit}`)
    }

    const position = netlifyImageCdnParams.get('position')
    if (position) {
      ipxParams.push(`position_${position}`)
    }

    const ipxModifiers = ipxParams.join(',')

    return new URL(`/${ipxModifiers || `_`}/${encodeURIComponent(imageURL.href)}`, imageURL.origin)
  }

  match(request: Request): ImageMatch | undefined {
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
