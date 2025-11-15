#!/bin/bash

# Supabase Edge Function Deployment Script
# This script automates the deployment of the refresh-google-token edge function

set -e  # Exit on error

echo "🚀 Supabase Edge Function Deployment Script"
echo "============================================"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo ""
    echo "Please create a .env file from the template:"
    echo "  cp .env.example .env"
    echo ""
    echo "Then edit .env and fill in your values:"
    echo "  - SUPABASE_PROJECT_REF (from your Supabase dashboard)"
    echo "  - SUPABASE_DB_PASSWORD (your database password)"
    echo "  - GOOGLE_OAUTH_CLIENT_ID (from Supabase > Auth > Providers > Google)"
    echo "  - GOOGLE_OAUTH_CLIENT_SECRET (from Supabase > Auth > Providers > Google)"
    exit 1
fi

# Load environment variables
echo "📋 Loading configuration from .env..."
source .env

# Validate required variables
if [ -z "$SUPABASE_PROJECT_REF" ] || [ "$SUPABASE_PROJECT_REF" = "your-project-ref-here" ]; then
    echo "❌ Error: SUPABASE_PROJECT_REF not set in .env"
    exit 1
fi

if [ -z "$GOOGLE_OAUTH_CLIENT_ID" ] || [ "$GOOGLE_OAUTH_CLIENT_ID" = "your-google-client-id.apps.googleusercontent.com" ]; then
    echo "❌ Error: GOOGLE_OAUTH_CLIENT_ID not set in .env"
    exit 1
fi

if [ -z "$GOOGLE_OAUTH_CLIENT_SECRET" ] || [ "$GOOGLE_OAUTH_CLIENT_SECRET" = "GOCSPX-your-client-secret" ]; then
    echo "❌ Error: GOOGLE_OAUTH_CLIENT_SECRET not set in .env"
    exit 1
fi

echo "✅ Configuration loaded successfully"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Error: Supabase CLI not found!"
    echo ""
    echo "Please install it first:"
    echo "  npm install -g supabase"
    echo ""
    echo "Or with Homebrew (macOS):"
    echo "  brew install supabase/tap/supabase"
    exit 1
fi

echo "✅ Supabase CLI found: $(supabase --version)"
echo ""

# Login check
echo "🔐 Checking Supabase authentication..."
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase"
    echo ""
    echo "Please login first:"
    echo "  supabase login"
    exit 1
fi
echo "✅ Authenticated"
echo ""

# Link project
echo "🔗 Linking to Supabase project: $SUPABASE_PROJECT_REF..."
if [ -n "$SUPABASE_DB_PASSWORD" ] && [ "$SUPABASE_DB_PASSWORD" != "your-database-password" ]; then
    supabase link --project-ref "$SUPABASE_PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"
else
    echo "⚠️  DB password not provided in .env, you may be prompted to enter it"
    supabase link --project-ref "$SUPABASE_PROJECT_REF"
fi
echo "✅ Project linked"
echo ""

# Deploy edge function
echo "📦 Deploying refresh-google-token edge function..."
supabase functions deploy refresh-google-token
echo "✅ Edge function deployed"
echo ""

# Set secrets
echo "🔒 Setting environment secrets..."
echo "  - Setting GOOGLE_OAUTH_CLIENT_ID..."
supabase secrets set GOOGLE_OAUTH_CLIENT_ID="$GOOGLE_OAUTH_CLIENT_ID" --project-ref "$SUPABASE_PROJECT_REF"

echo "  - Setting GOOGLE_OAUTH_CLIENT_SECRET..."
supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET="$GOOGLE_OAUTH_CLIENT_SECRET" --project-ref "$SUPABASE_PROJECT_REF"

echo "✅ Secrets configured"
echo ""

# Verify deployment
echo "🔍 Verifying deployment..."
supabase functions list --project-ref "$SUPABASE_PROJECT_REF"
echo ""

echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Rebuild your extension: npm run build"
echo "  2. Reload the extension in Chrome"
echo "  3. Sign in with Google"
echo "  4. Token refresh will happen automatically!"
echo ""
echo "🔧 To view logs:"
echo "  supabase functions logs refresh-google-token --project-ref $SUPABASE_PROJECT_REF"
echo ""
echo "✨ Your Google Calendar tokens will now refresh automatically!"
