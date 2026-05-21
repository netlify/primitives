import type { Context } from '@netlify/types'

import { contextStore } from './context_store.js'

export const getContext = (): Context | null => contextStore.getStore()?.context ?? null
