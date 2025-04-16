export interface ListResponse {
  blobs?: ListResponseBlob[]
  directories?: string[]
  next_cursor?: string
}

export interface ListResponseBlob {
  etag: string
  last_modified: string
  size: number
  key: string
}
