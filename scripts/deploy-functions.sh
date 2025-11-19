#!/bin/bash
#
# Deploy Edge Functions to Supabase
# Usage: ./scripts/deploy-functions.sh [function-name]
#        ./scripts/deploy-functions.sh           (deploys all)
#        ./scripts/deploy-functions.sh sync-gmail (deploys one)
#

set -e

echo "=========================================="
echo "Deploying Edge Functions"
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

# List of mail-related Edge Functions
FUNCTIONS=(
    "gmail-oauth-init"
    "gmail-oauth-callback"
    "sync-gmail"
    "process-mail-summary"
)

# If a specific function is provided, deploy only that one
if [ ! -z "$1" ]; then
    echo "🚀 Deploying function: $1"
    supabase functions deploy "$1" --no-verify-jwt
    echo "✅ Function $1 deployed successfully!"
    exit 0
fi

# Deploy all functions
echo "📋 Mail-related functions to deploy:"
for func in "${FUNCTIONS[@]}"; do
    echo "   - $func"
done
echo ""

for func in "${FUNCTIONS[@]}"; do
    echo "🚀 Deploying $func..."
    supabase functions deploy "$func" --no-verify-jwt
    echo ""
done

echo "✅ All Edge Functions deployed successfully!"
echo ""
echo "Next steps:"
echo "1. Set environment secrets: ./scripts/setup-secrets.sh"
echo "2. Enable the cron job in Supabase SQL Editor"
echo ""
echo "To test locally:"
echo "  supabase functions serve sync-gmail --env-file ./supabase/.env"
