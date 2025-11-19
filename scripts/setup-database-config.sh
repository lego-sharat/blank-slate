#!/bin/bash

set -e

echo "=========================================="
echo "Setup Database Configuration"
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
    echo "Please create supabase/.env and add required variables"
    exit 1
fi

# Read settings from .env file
SUPABASE_URL=$(grep -E '^SUPABASE_URL=' supabase/.env 2>/dev/null | cut -d '=' -f2-)
SERVICE_ROLE_KEY=$(grep -E '^SUPABASE_SERVICE_ROLE_KEY=' supabase/.env 2>/dev/null | cut -d '=' -f2-)
SUPABASE_PROJECT_REF=$(grep -E '^SUPABASE_PROJECT_REF=' supabase/.env 2>/dev/null | cut -d '=' -f2-)

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
    echo "❌ Missing Supabase URL or Service Role Key in supabase/.env"
    echo ""
    echo "Please add these to your supabase/.env file:"
    echo "  SUPABASE_URL=https://your-project-ref.supabase.co"
    echo "  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here"
    echo ""
    echo "Get these from: Supabase Dashboard → Settings → API"
    exit 1
fi

if [ -z "$SUPABASE_PROJECT_REF" ]; then
    echo "❌ SUPABASE_PROJECT_REF not found in supabase/.env"
    exit 1
fi

# Link to Supabase project
echo "🔗 Ensuring project is linked: $SUPABASE_PROJECT_REF"
supabase link --project-ref "$SUPABASE_PROJECT_REF" 2>&1 || echo "Note: Link command completed"
echo ""

echo "Setting database configuration..."
echo "  • Service role key: [HIDDEN]"
echo "  • Supabase URL: $SUPABASE_URL"
echo ""

# Create SQL to set config using the _config table
SQL_CONFIG="SELECT set_config('service_role_key', '$SERVICE_ROLE_KEY');
SELECT set_config('supabase_url', '$SUPABASE_URL');"

# Execute SQL
echo "$SQL_CONFIG" | supabase db execute

echo ""
echo "✅ Database settings configured successfully!"
echo ""
echo "Verify the settings:"
echo "  SELECT * FROM _config;"
echo ""
