#!/bin/bash

set -e

echo "=========================================="
echo "Deploying Mail Edge Functions"
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

echo "📦 Deploying Edge Functions..."
echo ""

# Deploy gmail-oauth-init
echo "Deploying gmail-oauth-init..."
supabase functions deploy gmail-oauth-init --no-verify-jwt

# Deploy gmail-oauth-callback
echo "Deploying gmail-oauth-callback..."
supabase functions deploy gmail-oauth-callback --no-verify-jwt

# Deploy sync-gmail
echo "Deploying sync-gmail..."
supabase functions deploy sync-gmail --no-verify-jwt

# Deploy process-mail-summary
echo "Deploying process-mail-summary..."
supabase functions deploy process-mail-summary --no-verify-jwt

echo ""
echo "✅ All mail Edge Functions deployed successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Enable the cron job by running enable-gmail-cron.sql in SQL Editor"
echo "   2. Test Gmail OAuth connection from your extension"
echo ""
