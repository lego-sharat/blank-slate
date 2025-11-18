#!/bin/bash
#
# Deploy database migrations to Supabase
# Usage: ./scripts/deploy-migrations.sh
#

set -e

echo "=========================================="
echo "Deploying Database Migrations"
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
    echo "   Run: supabase link --project-ref YOUR_PROJECT_REF"
    exit 1
fi

echo "📋 Found migrations:"
ls -1 supabase/migrations/*.sql
echo ""

echo "🚀 Deploying migrations..."
supabase db push

echo ""
echo "✅ Migrations deployed successfully!"
echo ""
echo "To verify, run:"
echo "  supabase db dump --data-only"
