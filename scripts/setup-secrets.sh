#!/bin/bash
#
# Set up Supabase Edge Function secrets
# Usage: ./scripts/setup-secrets.sh
#
# This script will prompt you for the required API keys and store them as secrets.
#

set -e

echo "=========================================="
echo "Setting up Edge Function Secrets"
echo "=========================================="
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if linked to a project (supabase commands will fail with clear error if not linked)
# Removed redundant check - let supabase CLI handle it

# Check if .env file exists
if [ ! -f supabase/.env ]; then
    echo "❌ supabase/.env not found."
    echo ""
    echo "Please create supabase/.env and add your credentials."
    echo "See supabase/.env.example for reference."
    exit 1
fi

echo "Reading secrets from supabase/.env..."
echo ""

# Read secrets from .env file
GOOGLE_CLIENT_ID=$(grep -E '^GOOGLE_(OAUTH_)?CLIENT_ID=' supabase/.env 2>/dev/null | cut -d '=' -f2-)
GOOGLE_CLIENT_SECRET=$(grep -E '^GOOGLE_(OAUTH_)?CLIENT_SECRET=' supabase/.env 2>/dev/null | cut -d '=' -f2-)
ANTHROPIC_API_KEY=$(grep -E '^ANTHROPIC_API_KEY=' supabase/.env 2>/dev/null | cut -d '=' -f2-)

# Validate required secrets
if [ -z "$GOOGLE_CLIENT_ID" ]; then
    echo "❌ GOOGLE_CLIENT_ID or GOOGLE_OAUTH_CLIENT_ID not found in supabase/.env"
    exit 1
fi

if [ -z "$GOOGLE_CLIENT_SECRET" ]; then
    echo "❌ GOOGLE_CLIENT_SECRET or GOOGLE_OAUTH_CLIENT_SECRET not found in supabase/.env"
    exit 1
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ ANTHROPIC_API_KEY not found in supabase/.env"
    exit 1
fi

echo "Setting secrets in Supabase..."
echo ""

# Set secrets using the correct format
supabase secrets set GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID"
echo "✅ GOOGLE_CLIENT_ID set"

supabase secrets set GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET"
echo "✅ GOOGLE_CLIENT_SECRET set"

supabase secrets set ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY"
echo "✅ ANTHROPIC_API_KEY set"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All secrets configured!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To verify secrets:"
echo "  supabase secrets list"
echo ""
echo "Next steps:"
echo "1. Deploy migrations: ./scripts/deploy-migrations.sh"
echo "2. Deploy Edge Functions: ./scripts/deploy-functions.sh"
echo "3. Enable cron job (see supabase/MAIL_SETUP.md)"
