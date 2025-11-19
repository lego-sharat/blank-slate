/**
 * Thoughts REST API Client
 * Background-safe Supabase client using direct REST API calls
 */

import type { Thought, ThoughtStatus } from '@/types'
import {
  getSupabaseCredentials,
  upsertRecords,
  selectRecords
} from './supabaseRestClient'

interface DbThought {
  id: number
  user_id: string
  title: string
  content: string
  status: string
  created_at: string
  updated_at: string
}

/**
 * Sync thoughts to Supabase
 */
export async function syncThoughtsToSupabase(thoughts: Thought[]): Promise<void> {
  try {
    const credentials = await getSupabaseCredentials()

    if (!credentials) {
      console.warn('⚠ Supabase not configured, skipping thoughts sync')
      return
    }

    if (!credentials.userId) {
      console.warn('⚠ No authenticated user, skipping thoughts sync')
      return
    }

    // Transform local thoughts to database format
    const dbThoughts: DbThought[] = thoughts.map(thought => ({
      id: thought.id,
      user_id: credentials.userId!,
      title: thought.title,
      content: thought.content,
      status: thought.status,
      created_at: new Date(thought.createdAt).toISOString(),
      updated_at: thought.updatedAt ? new Date(thought.updatedAt).toISOString() : new Date().toISOString(),
    }))

    // Upsert thoughts
    await upsertRecords(credentials, 'thoughts', dbThoughts)

    console.log(`✓ Synced ${thoughts.length} thoughts to Supabase`)
  } catch (error) {
    console.error('✗ Failed to sync thoughts to Supabase:', error)
    throw error
  }
}

/**
 * Fetch thoughts from Supabase
 */
export async function fetchThoughtsFromSupabase(): Promise<Thought[]> {
  try {
    const credentials = await getSupabaseCredentials()

    if (!credentials) {
      console.warn('Supabase not configured, skipping thoughts fetch')
      return []
    }

    if (!credentials.userId) {
      console.warn('No authenticated user, skipping thoughts fetch')
      return []
    }

    // Fetch thoughts for current user
    const dbThoughts = await selectRecords<DbThought>(
      credentials,
      'thoughts',
      { user_id: `eq.${credentials.userId}` },
      { column: 'updated_at', ascending: false }
    )

    // Transform database format to local format
    const thoughts: Thought[] = dbThoughts.map(dbThought => ({
      id: dbThought.id,
      title: dbThought.title,
      content: dbThought.content || '',
      status: dbThought.status as ThoughtStatus,
      createdAt: new Date(dbThought.created_at).getTime(),
      updatedAt: new Date(dbThought.updated_at).getTime(),
    }))

    console.log(`✓ Fetched ${thoughts.length} thoughts from Supabase`)
    return thoughts
  } catch (error) {
    console.error('Failed to fetch thoughts from Supabase:', error)
    return []
  }
}
