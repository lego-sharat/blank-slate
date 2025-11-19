/**
 * History REST API Client
 * Background-safe Supabase client using direct REST API calls
 */

import type { HistoryItem, HistoryItemType } from '@/types'
import {
  getSupabaseCredentials,
  upsertRecords,
  selectRecords
} from './supabaseRestClient'

interface DbHistory {
  id: string
  user_id: string
  url: string
  title: string
  app: string
  visited_at: string
  created_at: string
  updated_at: string
}

/**
 * Sync history to Supabase
 */
export async function syncHistoryToSupabase(history: HistoryItem[]): Promise<void> {
  try {
    const credentials = await getSupabaseCredentials()

    if (!credentials) {
      console.warn('⚠ Supabase not configured, skipping history sync')
      return
    }

    if (!credentials.userId) {
      console.warn('⚠ No authenticated user, skipping history sync')
      return
    }

    // Transform local history to database format
    const dbHistory: DbHistory[] = history.map(item => ({
      id: item.id,
      user_id: credentials.userId!,
      url: item.url,
      title: item.title,
      app: item.type,
      visited_at: new Date(item.visitedAt).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    // Upsert history
    await upsertRecords(credentials, 'history', dbHistory)

    console.log(`✓ Synced ${history.length} history items to Supabase`)
  } catch (error) {
    console.error('✗ Failed to sync history to Supabase:', error)
    throw error
  }
}

/**
 * Fetch history from Supabase
 */
export async function fetchHistoryFromSupabase(): Promise<HistoryItem[]> {
  try {
    const credentials = await getSupabaseCredentials()

    if (!credentials) {
      console.warn('Supabase not configured, skipping history fetch')
      return []
    }

    if (!credentials.userId) {
      console.warn('No authenticated user, skipping history fetch')
      return []
    }

    // Fetch history for current user
    const dbHistory = await selectRecords<DbHistory>(
      credentials,
      'history',
      { user_id: `eq.${credentials.userId}` },
      { column: 'visited_at', ascending: false },
      100 // Limit to 100 items
    )

    // Transform database format to local format
    const history: HistoryItem[] = dbHistory.map(dbItem => ({
      id: dbItem.id,
      type: dbItem.app as HistoryItemType,
      title: dbItem.title,
      url: dbItem.url,
      visitedAt: new Date(dbItem.visited_at).getTime(),
    }))

    console.log(`✓ Fetched ${history.length} history items from Supabase`)
    return history
  } catch (error) {
    console.error('Failed to fetch history from Supabase:', error)
    return []
  }
}
