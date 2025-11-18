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

# Create .env.local if it doesn't exist
if [ ! -f supabase/.env.local ]; then
    echo "📝 Creating supabase/.env.local..."
    cat > supabase/.env.local <<EOF
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
    echo "⚠️  Please edit supabase/.env.local and add your API keys"
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
echo "🚀 Starting local Edge Function: $FUNCTION_NAME"
echo "   Serving at: http://localhost:54321/functions/v1/$FUNCTION_NAME"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start local Supabase if not running
if ! curl -s http://localhost:54321 > /dev/null 2>&1; then
    echo "Starting local Supabase..."
    supabase start &
    sleep 5
fi

# Serve the function
supabase functions serve "$FUNCTION_NAME" --env-file ./supabase/.env.local --debug
