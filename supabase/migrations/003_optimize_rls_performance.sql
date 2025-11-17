-- Optimize RLS policies to prevent re-evaluation of auth.uid() for each row
-- Replace auth.uid() with (select auth.uid()) for better performance

-- Drop existing policies for todos
DROP POLICY IF EXISTS "Users can view their own todos" ON todos;
DROP POLICY IF EXISTS "Users can insert their own todos" ON todos;
DROP POLICY IF EXISTS "Users can update their own todos" ON todos;
DROP POLICY IF EXISTS "Users can delete their own todos" ON todos;

-- Create optimized RLS policies for todos
CREATE POLICY "Users can view their own todos"
  ON todos FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own todos"
  ON todos FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own todos"
  ON todos FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own todos"
  ON todos FOR DELETE
  USING ((select auth.uid()) = user_id);

-- Drop existing policies for thoughts
DROP POLICY IF EXISTS "Users can view their own thoughts" ON thoughts;
DROP POLICY IF EXISTS "Users can insert their own thoughts" ON thoughts;
DROP POLICY IF EXISTS "Users can update their own thoughts" ON thoughts;
DROP POLICY IF EXISTS "Users can delete their own thoughts" ON thoughts;

-- Create optimized RLS policies for thoughts
CREATE POLICY "Users can view their own thoughts"
  ON thoughts FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own thoughts"
  ON thoughts FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own thoughts"
  ON thoughts FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own thoughts"
  ON thoughts FOR DELETE
  USING ((select auth.uid()) = user_id);

-- Drop existing policies for history
DROP POLICY IF EXISTS "Users can view their own history" ON history;
DROP POLICY IF EXISTS "Users can insert their own history" ON history;
DROP POLICY IF EXISTS "Users can update their own history" ON history;
DROP POLICY IF EXISTS "Users can delete their own history" ON history;

-- Create optimized RLS policies for history
CREATE POLICY "Users can view their own history"
  ON history FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their own history"
  ON history FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their own history"
  ON history FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their own history"
  ON history FOR DELETE
  USING ((select auth.uid()) = user_id);
