import { imageSize } from 'image-size'
import { generateImage as generateImageCallback } from 'js-image-generator'

/**
 * Returns Buffer of a generated random noise jpeg image with the specified width and height.
 */
export async function generateImage(width: number, height: number): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    generateImageCallback(width, height, 80, (error, image) => {
      if (error) {
        reject(error)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const imageBuffer = image.data as Buffer

        resolve(imageBuffer)
      }
    })
  })
}

export async function getImageResponseSize(response: Response) {
  return imageSize(new Uint8Array(await response.arrayBuffer()))
}
