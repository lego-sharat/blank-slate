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

# Check if we're linked to a project
if [ ! -f .supabase/config.toml ]; then
    echo "❌ Not linked to a Supabase project"
    echo "   Run: supabase link --project-ref YOUR_PROJECT_REF"
    exit 1
fi

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
