#!/bin/bash

# Supabase Setup Script
# This script helps you set up Supabase tables for the Chrome extension

set -e

echo "🚀 Supabase Setup for Chrome Extension"
echo "========================================"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found!"
    echo ""
    echo "Please install it first:"
    echo "  npm install -g supabase"
    echo ""
    echo "Or visit: https://supabase.com/docs/guides/cli"
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Check if user is logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase"
    echo ""
    echo "Please login first:"
    echo "  supabase login"
    exit 1
fi

echo "✅ Logged in to Supabase"
echo ""

# Ask for project ref
echo "📋 Please enter your Supabase project reference ID"
echo "   (Found in your project URL: https://app.supabase.com/project/YOUR_PROJECT_REF)"
echo ""
read -p "Project Ref: " PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    echo "❌ Project ref is required"
    exit 1
fi

echo ""
echo "🔗 Linking to project: $PROJECT_REF"
supabase link --project-ref "$PROJECT_REF"

echo ""
echo "📦 Pushing database migrations..."
supabase db push

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "1. Go to your Supabase dashboard: https://app.supabase.com/project/$PROJECT_REF"
echo "2. Navigate to Project Settings → API"
echo "3. Copy your:"
echo "   - Project URL"
echo "   - anon/public API key"
echo "4. Add them to your Chrome extension Settings"
echo ""
echo "🎉 You're all set!"
