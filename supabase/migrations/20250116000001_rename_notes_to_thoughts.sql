-- Rename notes table to thoughts
ALTER TABLE IF EXISTS notes RENAME TO thoughts;

-- If the table was just created, create it as thoughts instead
CREATE TABLE IF NOT EXISTS thoughts (
  id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'draft' NOT NULL,
  "createdAt" BIGINT NOT NULL,
  "updatedAt" BIGINT,
  user_id UUID DEFAULT auth.uid()
);

-- Recreate indexes with new table name
DROP INDEX IF EXISTS notes_user_id_idx;
DROP INDEX IF EXISTS notes_status_idx;
DROP INDEX IF EXISTS notes_updated_at_idx;

CREATE INDEX IF NOT EXISTS thoughts_user_id_idx ON thoughts(user_id);
CREATE INDEX IF NOT EXISTS thoughts_status_idx ON thoughts(status);
CREATE INDEX IF NOT EXISTS thoughts_updated_at_idx ON thoughts("updatedAt");

-- Enable Row Level Security
ALTER TABLE thoughts ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Users can view their own notes" ON thoughts;
DROP POLICY IF EXISTS "Users can insert their own notes" ON thoughts;
DROP POLICY IF EXISTS "Users can update their own notes" ON thoughts;
DROP POLICY IF EXISTS "Users can delete their own notes" ON thoughts;

-- Create RLS policies for thoughts
CREATE POLICY "Users can view their own thoughts"
  ON thoughts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own thoughts"
  ON thoughts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own thoughts"
  ON thoughts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own thoughts"
  ON thoughts FOR DELETE
  USING (auth.uid() = user_id);
