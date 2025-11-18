// @ts-ignore
import { getSupabase as getSupabaseClient } from '@/supabase';
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
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn('⚠ No authenticated user, skipping todos sync');
      return;
    }

    // Transform local todos to database format with user_id
    const dbTodos = todos.map(todo => ({
      id: todo.id,
      user_id: user.id,
      text: todo.text,
      completed: todo.completed,
      created_at: new Date(todo.createdAt).toISOString(),
      updated_at: new Date().toISOString(),
    }));

    // Upsert todos (insert or update)
    const { error } = await supabase
      .from('todos')
      .upsert(dbTodos, { onConflict: 'id' });

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
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn('No authenticated user, skipping todos fetch');
      return [];
    }

    const { data, error } = await supabase
      .from('todos')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Transform database format to local format
    const todos: Todo[] = (data || []).map((dbTodo: any) => ({
      id: dbTodo.id,
      text: dbTodo.text,
      completed: dbTodo.completed,
      createdAt: new Date(dbTodo.created_at).getTime(),
    }));

    console.log('Fetched', todos.length, 'todos from Supabase');
    return todos;
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
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn('⚠ No authenticated user, skipping thoughts sync');
      return;
    }

    // Transform local thoughts to database format with user_id
    const dbThoughts = thoughts.map(thought => ({
      id: thought.id,
      user_id: user.id,
      title: thought.title,
      content: thought.content,
      status: thought.status,
      created_at: new Date(thought.createdAt).toISOString(),
      updated_at: thought.updatedAt ? new Date(thought.updatedAt).toISOString() : new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('thoughts')
      .upsert(dbThoughts, { onConflict: 'id' });

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
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn('No authenticated user, skipping thoughts fetch');
      return [];
    }

    const { data, error } = await supabase
      .from('thoughts')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Transform database format to local format
    const thoughts: Thought[] = (data || []).map((dbThought: any) => ({
      id: dbThought.id,
      title: dbThought.title,
      content: dbThought.content || '',
      status: dbThought.status,
      createdAt: new Date(dbThought.created_at).getTime(),
      updatedAt: new Date(dbThought.updated_at).getTime(),
    }));

    console.log('Fetched', thoughts.length, 'thoughts from Supabase');
    return thoughts;
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
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn('⚠ No authenticated user, skipping history sync');
      return;
    }

    // Transform local history to database format with user_id
    const dbHistory = history.map(item => ({
      id: item.id,
      user_id: user.id,
      url: item.url,
      title: item.title,
      app: item.type,
      visited_at: new Date(item.visitedAt).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('history')
      .upsert(dbHistory, { onConflict: 'id' });

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
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      console.warn('No authenticated user, skipping history fetch');
      return [];
    }

    const { data, error } = await supabase
      .from('history')
      .select('*')
      .eq('user_id', user.id)
      .order('visited_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Transform database format to local format
    const history: HistoryItem[] = (data || []).map((dbItem: any) => ({
      id: dbItem.id,
      type: dbItem.app,
      title: dbItem.title,
      url: dbItem.url,
      visitedAt: new Date(dbItem.visited_at).getTime(),
    }));

    console.log('Fetched', history.length, 'history items from Supabase');
    return history;
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
