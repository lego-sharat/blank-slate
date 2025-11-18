#!/bin/bash
#
# Test Edge Functions locally
# Usage: ./scripts/test-local.sh [function-name]
#        ./scripts/test-local.sh sync-gmail
#

set -e

echo "=========================================="
echo "Testing Edge Functions Locally"
echo "=========================================="
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Create .env if it doesn't exist
if [ ! -f supabase/.env ]; then
    echo "📝 Creating supabase/.env..."
    cat > supabase/.env <<EOF
# Google OAuth Credentials
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Anthropic API Key
ANTHROPIC_API_KEY=your-anthropic-api-key

# Supabase (automatically provided by CLI)
# SUPABASE_URL=http://localhost:54321
# SUPABASE_ANON_KEY=...
# SUPABASE_SERVICE_ROLE_KEY=...
EOF
    echo "⚠️  Please edit supabase/.env and add your API keys"
    echo "   Then run this script again."
    exit 1
fi

# Check if function name is provided
if [ -z "$1" ]; then
    echo "Usage: $0 [function-name]"
    echo ""
    echo "Available functions:"
    echo "  - gmail-oauth-init"
    echo "  - gmail-oauth-callback"
    echo "  - sync-gmail"
    echo "  - process-mail-summary"
    echo ""
    read -p "Enter function name: " FUNCTION_NAME
else
    FUNCTION_NAME=$1
fi

# Check if function exists
if [ ! -d "supabase/functions/$FUNCTION_NAME" ]; then
    echo "❌ Function not found: $FUNCTION_NAME"
    echo "   Available functions:"
    ls -1 supabase/functions/
    exit 1
fi

echo ""
echo "🚀 Preparing local environment..."
echo ""

# Start local Supabase if not running
if ! curl -s http://localhost:54321 > /dev/null 2>&1; then
    echo "Starting local Supabase..."
    supabase start
    echo ""
fi

# Apply migrations if needed
echo "Applying database migrations..."
supabase db push 2>/dev/null || echo "Migrations already applied"
echo ""

# Set encryption key in local database if not already set
echo "Configuring encryption key for local testing..."

# Try to read encryption key from .env
if [ -f supabase/.env ]; then
    ENCRYPTION_KEY=$(grep -E '^ENCRYPTION_KEY=' supabase/.env 2>/dev/null | cut -d '=' -f2-)
fi

# If not found in .env, generate a random one
if [ -z "$ENCRYPTION_KEY" ]; then
    echo "No ENCRYPTION_KEY found in .env, generating random key..."
    ENCRYPTION_KEY=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
    echo "💡 Tip: Add ENCRYPTION_KEY=$ENCRYPTION_KEY to supabase/.env for consistency"
fi

# Check if encryption key is already set in database
KEY_CHECK=$(echo "SELECT current_setting('app.encryption_key', true);" | supabase db execute 2>/dev/null | grep -v "current_setting" | grep -v "^-" | grep -v "row" | tr -d ' ' || echo "")

if [ -z "$KEY_CHECK" ] || [ "$KEY_CHECK" = "" ]; then
    echo "Setting encryption key in local database..."
    SQL="ALTER DATABASE postgres SET app.encryption_key TO '$ENCRYPTION_KEY';"
    echo "$SQL" | supabase db execute
    echo "✅ Encryption key configured for local testing"
else
    echo "✅ Encryption key already configured in database"
fi
echo ""

echo "🚀 Starting local Edge Function: $FUNCTION_NAME"
echo "   Serving at: http://localhost:54321/functions/v1/$FUNCTION_NAME"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Serve the function
supabase functions serve "$FUNCTION_NAME" --env-file ./supabase/.env --debug
