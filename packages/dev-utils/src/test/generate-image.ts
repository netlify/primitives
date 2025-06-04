import { generateImage as generateImageCallback } from 'js-image-generator'

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
