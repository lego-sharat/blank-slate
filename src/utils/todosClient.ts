/**
 * Todos REST API Client
 * Background-safe Supabase client using direct REST API calls
 */

import type { Todo } from '@/types'
import {
  getSupabaseCredentials,
  upsertRecords,
  selectRecords
} from './supabaseRestClient'

interface DbTodo {
  id: number
  user_id: string
  text: string
  completed: boolean
  created_at: string
  updated_at: string
}

/**
 * Sync todos to Supabase
 */
export async function syncTodosToSupabase(todos: Todo[]): Promise<void> {
  try {
    const credentials = await getSupabaseCredentials()

    if (!credentials) {
      console.warn('⚠ Supabase not configured, skipping todos sync')
      return
    }

    if (!credentials.userId) {
      console.warn('⚠ No authenticated user, skipping todos sync')
      return
    }

    // Transform local todos to database format
    const dbTodos: DbTodo[] = todos.map(todo => ({
      id: todo.id,
      user_id: credentials.userId!,
      text: todo.text,
      completed: todo.completed,
      created_at: new Date(todo.createdAt).toISOString(),
      updated_at: new Date().toISOString(),
    }))

    // Upsert todos
    await upsertRecords(credentials, 'todos', dbTodos)

    console.log(`✓ Synced ${todos.length} todos to Supabase`)
  } catch (error) {
    console.error('✗ Failed to sync todos to Supabase:', error)
    throw error
  }
}

/**
 * Fetch todos from Supabase
 */
export async function fetchTodosFromSupabase(): Promise<Todo[]> {
  try {
    const credentials = await getSupabaseCredentials()

    if (!credentials) {
      console.warn('Supabase not configured, skipping todos fetch')
      return []
    }

    if (!credentials.userId) {
      console.warn('No authenticated user, skipping todos fetch')
      return []
    }

    // Fetch todos for current user
    const dbTodos = await selectRecords<DbTodo>(
      credentials,
      'todos',
      { user_id: `eq.${credentials.userId}` },
      { column: 'created_at', ascending: false }
    )

    // Transform database format to local format
    const todos: Todo[] = dbTodos.map(dbTodo => ({
      id: dbTodo.id,
      text: dbTodo.text,
      completed: dbTodo.completed,
      createdAt: new Date(dbTodo.created_at).getTime(),
    }))

    console.log(`✓ Fetched ${todos.length} todos from Supabase`)
    return todos
  } catch (error) {
    console.error('Failed to fetch todos from Supabase:', error)
    return []
  }
}
