/**
 * Shared Supabase REST API client utilities
 * Used by todos, thoughts, history, and mail clients
 *
 * This avoids importing @supabase/supabase-js which includes Realtime
 * library with DOM dependencies that break in service workers.
 */

export interface SupabaseCredentials {
  url: string
  key: string
  userId?: string
  accessToken?: string
}

/**
 * Get Supabase credentials from chrome.storage
 */
export async function getSupabaseCredentials(): Promise<SupabaseCredentials | null> {
  try {
    const result = await chrome.storage.local.get([
      'supabaseUrl',
      'supabaseKey',
      'supabaseSession'
    ])

    if (!result.supabaseUrl || !result.supabaseKey ||
        typeof result.supabaseUrl !== 'string' ||
        typeof result.supabaseKey !== 'string') {
      console.log('[Supabase REST] Not configured')
      return null
    }

    // Extract user ID and access token from session
    let userId: string | undefined
    let accessToken: string | undefined

    if (result.supabaseSession) {
      const session = result.supabaseSession as any
      userId = session.user?.id
      accessToken = session.access_token
    }

    return {
      url: result.supabaseUrl,
      key: result.supabaseKey,
      userId,
      accessToken
    }
  } catch (error) {
    console.error('[Supabase REST] Error getting credentials:', error)
    return null
  }
}

/**
 * Make a REST API call to Supabase
 */
export async function supabaseFetch<T = any>(
  credentials: SupabaseCredentials,
  table: string,
  options: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    params?: Record<string, string>
    body?: any
    prefer?: string
  }
): Promise<T> {
  const { url, key, accessToken } = credentials
  const { method, params, body, prefer } = options

  // Build URL with query params
  const queryString = params ? `?${new URLSearchParams(params).toString()}` : ''
  const apiUrl = `${url}/rest/v1/${table}${queryString}`

  // Build headers
  const headers: Record<string, string> = {
    'apikey': key,
    'Authorization': `Bearer ${accessToken || key}`,
    'Content-Type': 'application/json',
  }

  if (prefer) {
    headers['Prefer'] = prefer
  }

  const response = await fetch(apiUrl, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Supabase REST API error: ${response.status} ${response.statusText} - ${errorText}`)
  }

  // For operations with Prefer: return=minimal, response body is empty
  if (prefer === 'return=minimal') {
    return null as T
  }

  return response.json()
}

/**
 * Upsert (insert or update) records
 */
export async function upsertRecords<T>(
  credentials: SupabaseCredentials,
  table: string,
  records: T[]
): Promise<void> {
  if (records.length === 0) {
    return
  }

  await supabaseFetch(credentials, table, {
    method: 'POST',
    body: records,
    prefer: 'resolution=merge-duplicates,return=minimal'
  })
}

/**
 * Select records with filters
 */
export async function selectRecords<T>(
  credentials: SupabaseCredentials,
  table: string,
  filters: Record<string, string>,
  orderBy?: { column: string; ascending?: boolean },
  limit?: number
): Promise<T[]> {
  const params: Record<string, string> = {
    ...filters,
    select: '*'
  }

  if (orderBy) {
    params.order = `${orderBy.column}.${orderBy.ascending ? 'asc' : 'desc'}`
  }

  if (limit) {
    params.limit = String(limit)
  }

  const result = await supabaseFetch<T[]>(credentials, table, {
    method: 'GET',
    params,
    prefer: 'return=representation'
  })

  return result || []
}
