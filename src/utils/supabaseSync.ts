import { getSupabaseClient } from './supabaseClient';
import type { Todo, Note, HistoryItem } from '@/types';

/**
 * Sync todos to Supabase
 */
export async function syncTodosToSupabase(todos: Todo[]): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('Supabase not configured, skipping todos sync');
    return;
  }

  try {
    // Upsert todos (insert or update)
    const { error } = await supabase
      .from('todos')
      .upsert(todos, { onConflict: 'id' });

    if (error) throw error;
    console.log('Synced', todos.length, 'todos to Supabase');
  } catch (error) {
    console.error('Failed to sync todos to Supabase:', error);
    throw error;
  }
}

/**
 * Fetch todos from Supabase
 */
export async function fetchTodosFromSupabase(): Promise<Todo[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('Supabase not configured, skipping todos fetch');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) throw error;
    console.log('Fetched', data?.length || 0, 'todos from Supabase');
    return data || [];
  } catch (error) {
    console.error('Failed to fetch todos from Supabase:', error);
    return [];
  }
}

/**
 * Sync notes to Supabase
 */
export async function syncNotesToSupabase(notes: Note[]): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('Supabase not configured, skipping notes sync');
    return;
  }

  try {
    const { error } = await supabase
      .from('notes')
      .upsert(notes, { onConflict: 'id' });

    if (error) throw error;
    console.log('Synced', notes.length, 'notes to Supabase');
  } catch (error) {
    console.error('Failed to sync notes to Supabase:', error);
    throw error;
  }
}

/**
 * Fetch notes from Supabase
 */
export async function fetchNotesFromSupabase(): Promise<Note[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('Supabase not configured, skipping notes fetch');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('updatedAt', { ascending: false });

    if (error) throw error;
    console.log('Fetched', data?.length || 0, 'notes from Supabase');
    return data || [];
  } catch (error) {
    console.error('Failed to fetch notes from Supabase:', error);
    return [];
  }
}

/**
 * Sync history to Supabase
 */
export async function syncHistoryToSupabase(history: HistoryItem[]): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('Supabase not configured, skipping history sync');
    return;
  }

  try {
    const { error } = await supabase
      .from('history')
      .upsert(history, { onConflict: 'id' });

    if (error) throw error;
    console.log('Synced', history.length, 'history items to Supabase');
  } catch (error) {
    console.error('Failed to sync history to Supabase:', error);
    throw error;
  }
}

/**
 * Fetch history from Supabase
 */
export async function fetchHistoryFromSupabase(): Promise<HistoryItem[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('Supabase not configured, skipping history fetch');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('history')
      .select('*')
      .order('visitedAt', { ascending: false })
      .limit(100);

    if (error) throw error;
    console.log('Fetched', data?.length || 0, 'history items from Supabase');
    return data || [];
  } catch (error) {
    console.error('Failed to fetch history from Supabase:', error);
    return [];
  }
}

/**
 * Sync all data to Supabase
 */
export async function syncAllToSupabase(
  todos: Todo[],
  notes: Note[],
  history: HistoryItem[]
): Promise<void> {
  console.log('Starting full Supabase sync...');

  await Promise.all([
    syncTodosToSupabase(todos),
    syncNotesToSupabase(notes),
    syncHistoryToSupabase(history),
  ]);

  console.log('Full Supabase sync complete');
}

/**
 * Fetch all data from Supabase
 */
export async function fetchAllFromSupabase(): Promise<{
  todos: Todo[];
  notes: Note[];
  history: HistoryItem[];
}> {
  console.log('Fetching all data from Supabase...');

  const [todos, notes, history] = await Promise.all([
    fetchTodosFromSupabase(),
    fetchNotesFromSupabase(),
    fetchHistoryFromSupabase(),
  ]);

  console.log('Fetched all data from Supabase');

  return { todos, notes, history };
}
