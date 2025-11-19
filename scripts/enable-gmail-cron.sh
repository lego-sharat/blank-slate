#!/bin/bash

set -e

echo "=========================================="
echo "Enable Gmail Sync Cron Job"
echo "=========================================="
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if .env file exists
if [ ! -f supabase/.env ]; then
    echo "❌ supabase/.env not found."
    echo "Please create supabase/.env and add SUPABASE_PROJECT_REF"
    exit 1
fi

# Read SUPABASE_PROJECT_REF from .env
SUPABASE_PROJECT_REF=$(grep -E '^SUPABASE_PROJECT_REF=' supabase/.env 2>/dev/null | cut -d '=' -f2-)

if [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo "❌ SUPABASE_PROJECT_REF not found in supabase/.env"
    echo "Please add: SUPABASE_PROJECT_REF=your-project-ref-here"
    exit 1
fi

# Link to Supabase project (will skip if already linked)
echo "🔗 Ensuring project is linked: $SUPABASE_PROJECT_REF"
supabase link --project-ref "$SUPABASE_PROJECT_REF" 2>&1 || echo "Note: Link command completed (this is usually fine)"
echo ""

echo "Enabling Gmail sync cron job (runs every 2 minutes)..."
echo ""

# Enable the cron job
SQL_CRON="
SELECT cron.schedule(
  'sync-gmail-all-users',
  '*/2 * * * *',
  \$\$SELECT trigger_gmail_sync();\$\$
);
"

echo "$SQL_CRON" | supabase db execute

echo ""
echo "✅ Cron job enabled successfully!"
echo ""
echo "The cron job will trigger every 2 minutes to sync Gmail for all connected users."
echo ""
echo "To verify the cron job is running:"
echo "  SELECT * FROM cron.job WHERE jobname = 'sync-gmail-all-users';"
echo ""
echo "To view cron job execution history:"
echo "  SELECT * FROM list_cron_history(10);"
echo ""
