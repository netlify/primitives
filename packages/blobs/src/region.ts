export const REGION_AUTO = 'auto'

const regions = {
  'us-east-1': true,
  'us-east-2': true,
}

export type Region = keyof typeof regions

export const isValidRegion = (input: string): input is Region => Object.keys(regions).includes(input)

export class InvalidBlobsRegionError extends Error {
  constructor(region: string) {
    super(
      `${region} is not a supported Netlify Blobs region. Supported values are: ${Object.keys(regions).join(', ')}.`,
    )

    this.name = 'InvalidBlobsRegionError'
  }
}
