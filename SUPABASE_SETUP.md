# Supabase Quick Setup Guide

## Quick Start (5 minutes)

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Login to Supabase

```bash
supabase login
```

### 3. Run Setup Script

```bash
./scripts/setup-supabase.sh
```

The script will:
- Link to your Supabase project
- Create all required tables
- Set up Row Level Security
- Create indexes for performance

### 4. Get Your Credentials

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Project Settings** → **API**
4. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public key** (starts with `eyJ...`)

### 5. Add to Chrome Extension

1. Open the extension
2. Go to **Settings**
3. Paste your Supabase URL and Key
4. Save

Done! Your data will now sync to Supabase.

---

## Manual Setup (Alternative)

If you prefer to run commands manually:

```bash
# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply migrations
supabase db push
```

---

## What Gets Created

Three tables with Row Level Security:

| Table | Purpose | Fields |
|-------|---------|--------|
| `todos` | Task management | id, text, completed, createdAt |
| `notes` | Note taking | id, title, content, status, createdAt, updatedAt |
| `history` | Browsing history | id, type, title, url, visitedAt, favicon |

All tables include:
- ✅ Row Level Security (RLS)
- ✅ User isolation (users only see their own data)
- ✅ Indexes for fast queries
- ✅ Automatic user_id tracking

---

## Testing

After setup, test the connection:

1. Open Chrome extension
2. Add a todo or note
3. Check Supabase dashboard → **Table Editor**
4. You should see your data syncing

---

## Troubleshooting

### "supabase: command not found"
Install the CLI:
```bash
npm install -g supabase
```

### "Not logged in"
Run:
```bash
supabase login
```

### "Tables already exist"
Already set up! No need to run again.

### Data not syncing?
1. Check Settings has correct URL and Key
2. Open browser console (F12)
3. Look for Supabase errors
4. Verify background script is running

---

## Advanced: Local Development

For local testing:

```bash
# Start local Supabase
supabase start

# Get local credentials
supabase status

# Use local API URL and anon key in extension
```

---

## Security Notes

- ✅ Row Level Security (RLS) is enabled
- ✅ Users can only access their own data
- ✅ Anon key is safe to use in client apps
- ⚠️ Never commit your `service_role` key
- ⚠️ Never share your project credentials

---

## Migration File

The migration is located at:
```
supabase/migrations/20250116000000_create_productivity_tables.sql
```

You can also run it manually in the SQL Editor if needed.
