import { getSupabaseClient } from './supabaseClient';
import type { Todo, Thought, HistoryItem } from '@/types';

/**
 * Sync todos to Supabase
 */
export async function syncTodosToSupabase(todos: Todo[]): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('⚠ Supabase client not initialized, skipping todos sync');
    return;
  }

  try {
    // Upsert todos (insert or update)
    const { error } = await supabase
      .from('todos')
      .upsert(todos, { onConflict: 'id' });

    if (error) throw error;
    console.log(`✓ Synced ${todos.length} todos to Supabase`);
  } catch (error) {
    console.error('✗ Failed to sync todos to Supabase:', error);
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
 * Sync thoughts to Supabase
 */
export async function syncThoughtsToSupabase(thoughts: Thought[]): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('⚠ Supabase client not initialized, skipping thoughts sync');
    return;
  }

  try {
    const { error } = await supabase
      .from('thoughts')
      .upsert(thoughts, { onConflict: 'id' });

    if (error) throw error;
    console.log(`✓ Synced ${thoughts.length} thoughts to Supabase`);
  } catch (error) {
    console.error('✗ Failed to sync thoughts to Supabase:', error);
    throw error;
  }
}

/**
 * Fetch thoughts from Supabase
 */
export async function fetchThoughtsFromSupabase(): Promise<Thought[]> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('Supabase not configured, skipping thoughts fetch');
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('thoughts')
      .select('*')
      .order('updatedAt', { ascending: false });

    if (error) throw error;
    console.log('Fetched', data?.length || 0, 'thoughts from Supabase');
    return data || [];
  } catch (error) {
    console.error('Failed to fetch thoughts from Supabase:', error);
    return [];
  }
}

/**
 * Sync history to Supabase
 */
export async function syncHistoryToSupabase(history: HistoryItem[]): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.warn('⚠ Supabase client not initialized, skipping history sync');
    return;
  }

  try {
    const { error } = await supabase
      .from('history')
      .upsert(history, { onConflict: 'id' });

    if (error) throw error;
    console.log(`✓ Synced ${history.length} history items to Supabase`);
  } catch (error) {
    console.error('✗ Failed to sync history to Supabase:', error);
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
  thoughts: Thought[],
  history: HistoryItem[]
): Promise<void> {
  console.log('Starting full Supabase sync...');

  try {
    await Promise.all([
      syncTodosToSupabase(todos),
      syncThoughtsToSupabase(thoughts),
      syncHistoryToSupabase(history),
    ]);

    console.log('✓ Full Supabase sync complete');
  } catch (error) {
    console.error('✗ Full Supabase sync failed:', error);
    throw error;
  }
}

/**
 * Fetch all data from Supabase
 */
export async function fetchAllFromSupabase(): Promise<{
  todos: Todo[];
  thoughts: Thought[];
  history: HistoryItem[];
}> {
  console.log('Fetching all data from Supabase...');

  const [todos, thoughts, history] = await Promise.all([
    fetchTodosFromSupabase(),
    fetchThoughtsFromSupabase(),
    fetchHistoryFromSupabase(),
  ]);

  console.log('Fetched all data from Supabase');

  return { todos, thoughts, history };
}
