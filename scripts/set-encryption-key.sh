#!/bin/bash
#
# Set encryption key in PostgreSQL database
# Usage: ./scripts/set-encryption-key.sh
#

set -e

echo "=========================================="
echo "Setting Encryption Key in Database"
echo "=========================================="
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Check if .env file exists
if [ ! -f supabase/.env ]; then
    echo "❌ supabase/.env not found."
    echo ""
    echo "Please create supabase/.env and add your credentials."
    echo "See supabase/.env.example for reference."
    exit 1
fi

echo "Reading encryption key from supabase/.env..."
ENCRYPTION_KEY=$(grep -E '^ENCRYPTION_KEY=' supabase/.env 2>/dev/null | cut -d '=' -f2-)

# Generate encryption key if not provided
if [ -z "$ENCRYPTION_KEY" ]; then
    echo "⚠️  ENCRYPTION_KEY not found in supabase/.env"
    echo "Generating a new encryption key..."
    ENCRYPTION_KEY=$(openssl rand -base64 32)
    echo "ENCRYPTION_KEY=$ENCRYPTION_KEY" >> supabase/.env
    echo "✅ Generated and saved ENCRYPTION_KEY to supabase/.env"
    echo ""
fi

echo "Setting encryption key in database..."

# Set the database parameter using psql via supabase
supabase db execute --sql "ALTER DATABASE postgres SET app.encryption_key TO '$ENCRYPTION_KEY';"

echo "✅ Encryption key set in database!"
echo ""
echo "The encryption key has been configured for OAuth token encryption."
