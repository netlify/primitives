import type { Logger } from '@netlify/dev-utils'
import { createIPX, createIPXWebServer, ipxFSStorage, ipxHttpStorage } from 'ipx'

interface ImagesConfig {
  remote_images: string[]
}

interface ImageHandlerOptions {
  imagesConfig?: ImagesConfig
  logger: Logger
  originServerAddress?: string
}

export interface ImageMatch {
  handle: () => Promise<Response>
}

const IMAGE_CDN_ENDPOINTS = ['/.netlify/images', '/.netlify/images/']

export class ImageHandler {
  #allowedRemoteUrlPatterns: RegExp[]
  #logger: Logger
  #originServerURL?: URL

  constructor({ logger, imagesConfig, originServerAddress }: ImageHandlerOptions) {
    this.#logger = logger
    this.#allowedRemoteUrlPatterns = (imagesConfig?.remote_images ?? []).reduce<RegExp[]>((acc, stringPattern) => {
      try {
        acc.push(new RegExp(stringPattern))
      } catch (maybeError) {
        const error = maybeError instanceof Error ? maybeError : new Error(String(maybeError))
        this.#logger.warn(`Malformed remote image pattern: "${stringPattern}": ${error.message}. Skipping it.`)
      }
      return acc
    }, [])
    this.#originServerURL = originServerAddress ? new URL(originServerAddress) : undefined
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

    if (!IMAGE_CDN_ENDPOINTS.includes(url.pathname)) {
      return
    }

    return {
      handle: async () => {
        if (request.method !== 'GET') {
          return new Response('Method Not Allowed', { status: 405 })
        }

        const sourceImageUrlParam = url.searchParams.get('url')
        if (!sourceImageUrlParam) {
          return new Response('Bad Request: Missing "url" query parameter', { status: 400 })
        }

        let sourceImageUrl: URL
        try {
          sourceImageUrl = new URL(sourceImageUrlParam, this.#originServerURL)
        } catch (error) {
          throw new Error(
            `Failed to construct source image URL from "${sourceImageUrlParam}".` +
              (!this.#originServerURL && !sourceImageUrlParam.startsWith('http')
                ? '\nLooks like source image is local and `originServerAddress` was not provided.'
                : ''),
            { cause: error },
          )
        }

        // if it's not local image, check if it's allowed
        if (
          sourceImageUrl.origin !== this.#originServerURL?.origin &&
          !this.#allowedRemoteUrlPatterns.some((allowedRemoteUrlPattern) =>
            allowedRemoteUrlPattern.test(sourceImageUrl.href),
          )
        ) {
          return new Response('Forbidden: Remote image URL not allowed', { status: 403 })
        }

        const ipx = createIPX({
          storage: ipxFSStorage(),
          httpStorage: ipxHttpStorage({
            // checking if url is allowed is done above, so we disable IPX checking
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
