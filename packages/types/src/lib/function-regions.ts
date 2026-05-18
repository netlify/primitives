interface FunctionRegionInfo {
  name: string
  awsRegion: string
}

export const FUNCTION_REGIONS = {
  cmh: { name: 'US East (Ohio)', awsRegion: 'us-east-2' },
  dub: { name: 'EU (Ireland)', awsRegion: 'eu-west-1' },
  fra: { name: 'EU (Frankfurt)', awsRegion: 'eu-central-1' },
  gru: { name: 'South America (São Paulo)', awsRegion: 'sa-east-1' },
  iad: { name: 'US East (N. Virginia)', awsRegion: 'us-east-1' },
  lhr: { name: 'EU (London)', awsRegion: 'eu-west-2' },
  nrt: { name: 'Asia Pacific (Tokyo)', awsRegion: 'ap-northeast-1' },
  pdx: { name: 'US West (Oregon)', awsRegion: 'us-west-2' },
  sfo: { name: 'US West (N. California)', awsRegion: 'us-west-1' },
  sin: { name: 'Asia Pacific (Singapore)', awsRegion: 'ap-southeast-1' },
  syd: { name: 'Asia Pacific (Sydney)', awsRegion: 'ap-southeast-2' },
  yul: { name: 'Canada (Central)', awsRegion: 'ca-central-1' },
} as const satisfies Record<string, FunctionRegionInfo>

type FunctionRegion = keyof typeof FUNCTION_REGIONS

export const FUNCTION_REGION_CODES = Object.keys(FUNCTION_REGIONS) as FunctionRegion[]
