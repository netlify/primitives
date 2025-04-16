type HttpStatusCode = number

export interface Redirect {
  from: string
  to?: string
  status?: HttpStatusCode
  force?: boolean
  signed?: string
  query?: Partial<Record<string, string>>
  headers?: Partial<Record<string, string>>
  conditions?: Partial<Record<'Language' | 'Role' | 'Country' | 'Cookie', readonly string[]>>
}
