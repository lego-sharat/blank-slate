# Supabase Setup

This directory contains Supabase migrations for the Chrome extension.

## Prerequisites

1. Install Supabase CLI:
```bash
npm install -g supabase
```

2. Login to Supabase:
```bash
supabase login
```

## Setup Instructions

### Option 1: Using Supabase CLI (Recommended)

1. **Link to your Supabase project:**
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

You can find your project ref in your Supabase dashboard URL:
`https://app.supabase.com/project/YOUR_PROJECT_REF`

2. **Run the migrations:**
```bash
supabase db push
```

This will apply all migrations in the `migrations/` directory to your Supabase database.

### Option 2: Using Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `migrations/20250116000000_create_productivity_tables.sql`
4. Paste and run the SQL

### Option 3: Using Local Development

1. **Start local Supabase:**
```bash
supabase start
```

2. **Apply migrations:**
```bash
supabase db reset
```

3. **Push to remote when ready:**
```bash
supabase db push
```

## What Gets Created

The migration creates three tables:

### `todos` table
- `id` (BIGINT, Primary Key)
- `text` (TEXT, NOT NULL)
- `completed` (BOOLEAN, default: false)
- `createdAt` (BIGINT, NOT NULL)
- `user_id` (UUID, default: auth.uid())

### `thoughts` table
- `id` (BIGINT, Primary Key)
- `title` (TEXT, NOT NULL)
- `content` (TEXT)
- `status` (TEXT, default: 'draft')
- `createdAt` (BIGINT, NOT NULL)
- `updatedAt` (BIGINT)
- `user_id` (UUID, default: auth.uid())

### `history` table
- `id` (TEXT, Primary Key)
- `type` (TEXT, NOT NULL)
- `title` (TEXT, NOT NULL)
- `url` (TEXT, NOT NULL)
- `visitedAt` (BIGINT, NOT NULL)
- `favicon` (TEXT)
- `user_id` (UUID, default: auth.uid())

## Security

All tables have:
- **Row Level Security (RLS)** enabled
- **Policies** that ensure users can only access their own data
- **Indexes** for optimal query performance

## Verifying the Setup

After running the migration, verify the tables were created:

```bash
supabase db dump --schema public
```

Or check in the Supabase dashboard under **Table Editor**.

## Getting Your Credentials

After setup, you need to add these to your extension settings:

1. **Supabase URL**: Found in Project Settings → API → Project URL
2. **Supabase Key**: Found in Project Settings → API → `anon` `public` key

Add these to your Chrome extension's Settings page.

## Troubleshooting

### Error: "relation already exists"
The tables already exist. You can either:
- Drop the tables first (⚠️ will delete data)
- Modify the migration to use `CREATE TABLE IF NOT EXISTS`

### Error: "permission denied"
Make sure you're logged in:
```bash
supabase login
```

And that you've linked to the correct project:
```bash
supabase link --project-ref YOUR_PROJECT_REF
```

## Creating New Migrations

To create a new migration:

```bash
supabase migration new your_migration_name
```

This creates a new file in `supabase/migrations/` where you can add your SQL.
