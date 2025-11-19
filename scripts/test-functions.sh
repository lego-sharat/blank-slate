#!/bin/bash
#
# Test Edge Functions with sample requests
# Usage: ./scripts/test-functions.sh [local|prod] [function-name]
#        ./scripts/test-functions.sh local sync-gmail
#        ./scripts/test-functions.sh prod gmail-oauth-init
#

set -e

# Parse arguments
ENV=${1:-local}
FUNCTION_NAME=$2

if [ "$ENV" != "local" ] && [ "$ENV" != "prod" ]; then
    echo "Usage: $0 [local|prod] [function-name]"
    echo ""
    echo "Environment:"
    echo "  local - Test against localhost:54321 (requires: supabase start)"
    echo "  prod  - Test against production Supabase"
    echo ""
    echo "Functions:"
    echo "  gmail-oauth-init       - Test OAuth initialization"
    echo "  gmail-oauth-callback   - Test OAuth callback"
    echo "  sync-gmail             - Test Gmail sync (requires service role key)"
    echo "  process-mail-summary   - Test AI summarization (requires service role key)"
    exit 1
fi

if [ -z "$FUNCTION_NAME" ]; then
    echo "Please specify a function name"
    exit 1
fi

# Set base URL based on environment
if [ "$ENV" = "local" ]; then
    BASE_URL="http://localhost:54321/functions/v1"
    echo "Testing locally at $BASE_URL"
    echo "Make sure Supabase is running: supabase start"
    echo ""
else
    # Get project ref from config
    if [ ! -f .supabase/config.toml ]; then
        echo "❌ Not linked to a Supabase project"
        exit 1
    fi
    PROJECT_REF=$(grep 'project_id' .supabase/config.toml | cut -d'"' -f2)
    BASE_URL="https://$PROJECT_REF.supabase.co/functions/v1"
    echo "Testing production at $BASE_URL"
    echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Testing: $FUNCTION_NAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Test based on function name
case "$FUNCTION_NAME" in
    "gmail-oauth-init")
        echo "Testing gmail-oauth-init..."
        echo "This requires a valid user access token."
        echo ""
        read -p "Enter your Supabase access token: " ACCESS_TOKEN
        echo ""

        curl -X POST "$BASE_URL/gmail-oauth-init" \
            -H "Authorization: Bearer $ACCESS_TOKEN" \
            -H "Content-Type: application/json" \
            | jq '.'
        ;;

    "gmail-oauth-callback")
        echo "Testing gmail-oauth-callback..."
        echo "This is normally called by Google OAuth redirect."
        echo "You shouldn't test this directly - use the OAuth flow instead."
        ;;

    "sync-gmail")
        echo "Testing sync-gmail..."
        echo "This requires the Supabase service role key."
        echo ""

        if [ "$ENV" = "local" ]; then
            # Get service role key from local Supabase
            SERVICE_ROLE_KEY=$(grep 'service_role' .supabase/config.toml | head -1 | cut -d'"' -f2)
        else
            read -sp "Enter your Supabase service role key: " SERVICE_ROLE_KEY
            echo ""
        fi

        echo ""
        echo "Triggering Gmail sync for all users..."
        curl -X POST "$BASE_URL/sync-gmail" \
            -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
            -H "Content-Type: application/json" \
            -d '{}' \
            | jq '.'
        ;;

    "process-mail-summary")
        echo "Testing process-mail-summary..."
        echo "This requires the Supabase service role key and a valid message ID."
        echo ""

        if [ "$ENV" = "local" ]; then
            SERVICE_ROLE_KEY=$(grep 'service_role' .supabase/config.toml | head -1 | cut -d'"' -f2)
        else
            read -sp "Enter your Supabase service role key: " SERVICE_ROLE_KEY
            echo ""
        fi

        read -p "Enter user ID (UUID): " USER_ID
        read -p "Enter message ID (UUID): " MESSAGE_ID

        echo ""
        echo "Processing mail summary..."
        curl -X POST "$BASE_URL/process-mail-summary" \
            -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
            -H "Content-Type: application/json" \
            -d "{\"userId\": \"$USER_ID\", \"messageIds\": [\"$MESSAGE_ID\"]}" \
            | jq '.'
        ;;

    *)
        echo "❌ Unknown function: $FUNCTION_NAME"
        exit 1
        ;;
esac

echo ""
echo "✅ Test complete"
