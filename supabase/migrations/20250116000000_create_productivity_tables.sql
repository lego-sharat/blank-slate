-- Create todos table
CREATE TABLE IF NOT EXISTS todos (
  id BIGINT PRIMARY KEY,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT false NOT NULL,
  "createdAt" BIGINT NOT NULL,
  user_id UUID DEFAULT auth.uid()
);

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
  id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  status TEXT DEFAULT 'draft' NOT NULL,
  "createdAt" BIGINT NOT NULL,
  "updatedAt" BIGINT,
  user_id UUID DEFAULT auth.uid()
);

-- Create history table
CREATE TABLE IF NOT EXISTS history (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  "visitedAt" BIGINT NOT NULL,
  favicon TEXT,
  user_id UUID DEFAULT auth.uid()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS todos_user_id_idx ON todos(user_id);
CREATE INDEX IF NOT EXISTS todos_completed_idx ON todos(completed);
CREATE INDEX IF NOT EXISTS todos_created_at_idx ON todos("createdAt");

CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);
CREATE INDEX IF NOT EXISTS notes_status_idx ON notes(status);
CREATE INDEX IF NOT EXISTS notes_updated_at_idx ON notes("updatedAt");

CREATE INDEX IF NOT EXISTS history_user_id_idx ON history(user_id);
CREATE INDEX IF NOT EXISTS history_type_idx ON history(type);
CREATE INDEX IF NOT EXISTS history_visited_at_idx ON history("visitedAt");
CREATE INDEX IF NOT EXISTS history_url_idx ON history(url);

-- Enable Row Level Security
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for todos
CREATE POLICY "Users can view their own todos"
  ON todos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own todos"
  ON todos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own todos"
  ON todos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own todos"
  ON todos FOR DELETE
  USING (auth.uid() = user_id);

-- Create RLS policies for notes
CREATE POLICY "Users can view their own notes"
  ON notes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notes"
  ON notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notes"
  ON notes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notes"
  ON notes FOR DELETE
  USING (auth.uid() = user_id);

-- Create RLS policies for history
CREATE POLICY "Users can view their own history"
  ON history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own history"
  ON history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own history"
  ON history FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own history"
  ON history FOR DELETE
  USING (auth.uid() = user_id);
