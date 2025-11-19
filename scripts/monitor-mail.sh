#!/bin/bash
#
# Monitor mail system status
# Usage: ./scripts/monitor-mail.sh [command]
#
# Commands:
#   cron-jobs    - List all cron jobs
#   cron-history - View recent cron job runs
#   function-logs - View Edge Function logs
#   mail-stats   - View mail statistics
#   oauth-status - View OAuth connection status
#

set -e

COMMAND=${1:-menu}

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

# Helper function to execute SQL
exec_sql() {
    local sql=$1
    echo "$sql" | supabase db execute
}

# Show menu if no command provided
if [ "$COMMAND" = "menu" ]; then
    echo "=========================================="
    echo "Mail System Monitoring"
    echo "=========================================="
    echo ""
    echo "Commands:"
    echo "  1. cron-jobs      - List all cron jobs"
    echo "  2. cron-history   - View recent cron runs"
    echo "  3. function-logs  - View Edge Function logs"
    echo "  4. mail-stats     - View mail statistics"
    echo "  5. oauth-status   - View OAuth connections"
    echo ""
    read -p "Enter command (or number): " CHOICE

    case "$CHOICE" in
        1|cron-jobs) COMMAND="cron-jobs" ;;
        2|cron-history) COMMAND="cron-history" ;;
        3|function-logs) COMMAND="function-logs" ;;
        4|mail-stats) COMMAND="mail-stats" ;;
        5|oauth-status) COMMAND="oauth-status" ;;
        *) echo "Invalid choice"; exit 1 ;;
    esac
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Running: $COMMAND"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

case "$COMMAND" in
    "cron-jobs")
        echo "Listing all cron jobs..."
        echo ""
        exec_sql "SELECT * FROM list_cron_jobs();"
        ;;

    "cron-history")
        echo "Recent cron job runs (last 20)..."
        echo ""
        exec_sql "SELECT * FROM list_cron_history(20);"
        ;;

    "function-logs")
        echo "Edge Function logs:"
        echo ""
        echo "Available functions:"
        echo "  - gmail-oauth-init"
        echo "  - gmail-oauth-callback"
        echo "  - sync-gmail"
        echo "  - process-mail-summary"
        echo ""
        read -p "Enter function name (or press Enter for all): " FUNC_NAME

        if [ -z "$FUNC_NAME" ]; then
            echo ""
            echo "Showing logs for all mail functions..."
            supabase functions logs --tail
        else
            echo ""
            echo "Showing logs for $FUNC_NAME..."
            supabase functions logs "$FUNC_NAME" --tail
        fi
        ;;

    "mail-stats")
        echo "Mail system statistics..."
        echo ""
        exec_sql "
        SELECT
          'Total Users' as metric,
          COUNT(DISTINCT user_id)::TEXT as value
        FROM oauth_tokens
        WHERE provider = 'gmail'

        UNION ALL

        SELECT
          'Total Messages' as metric,
          COUNT(*)::TEXT as value
        FROM mail_messages

        UNION ALL

        SELECT
          'Messages (Last 24h)' as metric,
          COUNT(*)::TEXT as value
        FROM mail_messages
        WHERE created_at > NOW() - INTERVAL '24 hours'

        UNION ALL

        SELECT
          'AI Summaries' as metric,
          COUNT(*)::TEXT as value
        FROM mail_summaries

        UNION ALL

        SELECT
          'Action Items' as metric,
          COUNT(*)::TEXT as value
        FROM mail_action_items

        UNION ALL

        SELECT
          'Uncompleted Actions' as metric,
          COUNT(*)::TEXT as value
        FROM mail_action_items
        WHERE is_completed = false;
        "
        ;;

    "oauth-status")
        echo "OAuth connection status..."
        echo ""
        exec_sql "
        SELECT
          ot.user_id,
          ot.provider,
          ot.updated_at as last_sync,
          COUNT(mm.id) as message_count,
          COUNT(ms.id) as summary_count
        FROM oauth_tokens ot
        LEFT JOIN mail_messages mm ON ot.user_id = mm.user_id
        LEFT JOIN mail_summaries ms ON mm.id = ms.message_id
        WHERE ot.provider = 'gmail'
        GROUP BY ot.user_id, ot.provider, ot.updated_at
        ORDER BY ot.updated_at DESC;
        "
        ;;

    *)
        echo "Unknown command: $COMMAND"
        echo ""
        echo "Available commands:"
        echo "  cron-jobs, cron-history, function-logs, mail-stats, oauth-status"
        exit 1
        ;;
esac

echo ""
echo "✅ Complete"
