#!/bin/bash
#
# Complete mail system setup script
# Usage: ./scripts/setup-mail.sh
#
# This script will:
# 1. Deploy database migrations
# 2. Set up Edge Function secrets
# 3. Deploy Edge Functions
# 4. Configure database settings (service role key, Supabase URL)
# 5. Enable the cron job
#

set -e

echo "=========================================="
echo "Mail System Setup"
echo "=========================================="
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if linked to a project
if [ ! -f .supabase/config.toml ]; then
    echo "⚠️  Not linked to a Supabase project."
    echo ""
    echo "First, link to your Supabase project:"
    echo "  1. Get your project ref from Supabase dashboard (Settings → General)"
    echo "  2. Run: supabase link --project-ref YOUR_PROJECT_REF"
    echo ""
    exit 1
fi

echo "This script will set up the complete mail system."
echo "You will need:"
echo "  • Google OAuth credentials (Client ID & Secret)"
echo "  • Anthropic API key"
echo "  • Supabase Service Role key"
echo "  • Supabase Project URL"
echo ""
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled"
    exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: Deploy Database Migrations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
./scripts/deploy-migrations.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Configure Edge Function Secrets"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
./scripts/setup-secrets.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Deploy Edge Functions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
./scripts/deploy-functions.sh

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 4: Configure Database Settings"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "These settings allow the database to call Edge Functions via pg_cron."
echo ""

read -p "Enter your Supabase URL (https://xxx.supabase.co): " SUPABASE_URL
read -sp "Enter your Service Role Key (from Settings → API): " SERVICE_ROLE_KEY
echo

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "❌ Missing Supabase URL or Service Role Key"
    echo "⚠️  You'll need to set these manually in the SQL editor:"
    echo ""
    echo "ALTER DATABASE postgres SET app.service_role_key TO 'your-service-role-key';"
    echo "ALTER DATABASE postgres SET app.supabase_url TO 'https://your-project.supabase.co';"
else
    echo ""
    echo "Setting database configuration..."

    # Create SQL to set database settings
    SQL_CONFIG="
    ALTER DATABASE postgres SET app.service_role_key TO '$SERVICE_ROLE_KEY';
    ALTER DATABASE postgres SET app.supabase_url TO '$SUPABASE_URL';
    "

    # Execute SQL
    echo "$SQL_CONFIG" | supabase db execute

    echo "✅ Database settings configured"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5: Enable Cron Job"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

read -p "Enable the cron job now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Enabling cron job..."

    SQL_CRON="
    SELECT cron.schedule(
      'sync-gmail-all-users',
      '*/2 * * * *',
      \$\$SELECT trigger_gmail_sync();\$\$
    );
    "

    echo "$SQL_CRON" | supabase db execute

    echo "✅ Cron job enabled (runs every 2 minutes)"
else
    echo "⚠️  Cron job not enabled. To enable manually, run this SQL:"
    echo ""
    echo "SELECT cron.schedule("
    echo "  'sync-gmail-all-users',"
    echo "  '*/2 * * * *',"
    echo "  \$\$SELECT trigger_gmail_sync();\$\$"
    echo ");"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Mail System Setup Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Open your extension and go to Settings"
echo "2. Configure Supabase URL and Anon Key"
echo "3. Sign in with Google"
echo "4. Click 'Connect Gmail' in Settings"
echo "5. Emails will start syncing every 2 minutes!"
echo ""
echo "To monitor the system:"
echo "  • View cron jobs: SELECT * FROM list_cron_jobs();"
echo "  • View cron history: SELECT * FROM list_cron_history(10);"
echo "  • Check Edge Function logs in Supabase Dashboard"
echo ""
echo "For troubleshooting, see: supabase/MAIL_SETUP.md"
