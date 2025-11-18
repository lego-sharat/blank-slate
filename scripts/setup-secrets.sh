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

# Check if linked to a project
if [ ! -f .supabase/config.toml ]; then
    echo "⚠️  Not linked to a Supabase project."
    echo "   Run: supabase link --project-ref YOUR_PROJECT_REF"
    exit 1
fi

echo "This script will set up the following secrets:"
echo "  1. GOOGLE_CLIENT_ID - Google OAuth Client ID"
echo "  2. GOOGLE_CLIENT_SECRET - Google OAuth Client Secret"
echo "  3. ANTHROPIC_API_KEY - Anthropic API key for Claude"
echo ""
echo "You can find these values in:"
echo "  - Google Cloud Console → APIs & Services → Credentials"
echo "  - Anthropic Console → API Keys"
echo ""

# Function to set a secret
set_secret() {
    local secret_name=$1
    local secret_description=$2

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Setting: $secret_name"
    echo "$secret_description"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Check if secret already exists
    if supabase secrets list 2>/dev/null | grep -q "$secret_name"; then
        echo "⚠️  Secret $secret_name already exists."
        read -p "Do you want to update it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Skipping $secret_name"
            return
        fi
    fi

    read -sp "Enter $secret_name: " secret_value
    echo

    if [ -z "$secret_value" ]; then
        echo "❌ Empty value, skipping"
        return
    fi

    echo "$secret_value" | supabase secrets set "$secret_name"
    echo "✅ $secret_name set successfully"
}

# Set each secret
set_secret "GOOGLE_CLIENT_ID" "Your Google OAuth 2.0 Client ID (from Google Cloud Console)"
set_secret "GOOGLE_CLIENT_SECRET" "Your Google OAuth 2.0 Client Secret (from Google Cloud Console)"
set_secret "ANTHROPIC_API_KEY" "Your Anthropic API key for Claude Haiku (from Anthropic Console)"

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
