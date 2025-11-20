# Email Client Extension - Development Roadmap

This document tracks the implementation progress of the Chrome Extension Email Client architecture improvements.

**Last Updated**: 2025-11-19
**Current Phase**: Phase 3 (Background Service Worker Architecture)

---

## Phase 1: Archive Functionality ✅ COMPLETED

**Goal**: Add ability to archive email threads from UI with Gmail sync

### Database Schema ✅
- [x] Add `status` field to mail_threads (active/archived/waiting/resolved)
- [x] Add `is_escalation` and `escalation_reason` fields
- [x] Add `archived_at` and `archive_source` fields
- [x] Add `customer_name` and `customer_mrr` fields for better UX
- [x] Create `gmail_archive_queue` table for async operations
- [x] Add indexes for performance (status, escalation, archived_at)
- [x] Create `archive_thread()` RPC function
- [x] Create `get_pending_archive_queue()` function
- [x] Create `update_archive_queue_status()` function
- [x] Create `cleanup_archive_queue()` function with proper error handling

**Migration File**: `supabase/migrations/20250119000001_add_archive_and_status_features.sql`

### Edge Functions ✅
- [x] Update `sync-gmail` to process archive queue every 2 minutes
- [x] Add `processArchiveQueue()` function with OAuth token refresh
- [x] Add `archiveThreadInGmail()` to remove INBOX/UNREAD labels
- [x] Add exponential backoff retry logic (3 attempts)
- [x] Add proper error handling and logging

**Files Modified**:
- `supabase/functions/sync-gmail/index.ts`

### Extension UI ✅
- [x] Add `archiveThread()` function to mailSupabaseSync.ts
- [x] Add Archive button to each thread in MailView
- [x] Implement optimistic UI updates (immediate removal from view)
- [x] Update TypeScript interfaces with new fields
- [x] Update fetch query to exclude archived threads

**Files Modified**:
- `src/utils/mailSupabaseSync.ts`
- `src/components/Mail/MailView.tsx`
- `src/utils/mailThreadsSync.ts`

### Deployment & Monitoring ✅
- [x] Create deployment scripts (deploy-migrations.sh, deploy-functions.sh)
- [x] Add archive-queue monitoring to monitor-mail.sh
- [x] Update documentation (scripts/README.md)
- [x] Create ARCHIVE_FEATURE_DEPLOYMENT.md guide

**Commits**:
- `b8a8282` - feat: Add email thread archive functionality
- `c9b51bb` - docs: Update deployment scripts for archive feature
- `fe3d193` - fix: SQL syntax error in cleanup_archive_queue function
- `824b845` - feat: Optimistically remove archived threads from UI

---

## Phase 2: Enhanced 6-View Navigation ✅ COMPLETED

**Goal**: Add specialized views for better email management

### UI Components ✅
- [x] Create NavigationSidebar component with 7 views:
  - [x] All Mail (default view)
  - [x] Escalations 🔥 (high-priority urgent threads)
  - [x] Onboarding 🎯 (new customer onboarding)
  - [x] Support 💬 (customer support requests)
  - [x] Newsletters 📰 (marketing/promotional)
  - [x] My Todos ✅ (threads with action items)
  - [x] Waiting ⏳ (waiting on customer response)
- [x] Add view filtering logic in MailView
- [x] Add computed viewCounts signal for real-time badges
- [x] Style navigation sidebar with CSS
- [x] Add active view highlighting
- [x] Add count badges to each view

**Files Created/Modified**:
- `src/components/Mail/NavigationSidebar.tsx` (NEW)
- `src/components/Mail/MailView.tsx` (MODIFIED)
- `src/pages/newtab/index.css` (+139 lines)

### AI Classification ✅
- [x] Update SummaryResult interface with escalation and status fields
- [x] Add escalation detection to AI prompt (customer-facing threads):
  - [x] Angry/frustrated customers
  - [x] Business-critical blockers
  - [x] Multiple unresolved follow-ups
  - [x] Requests for senior management
  - [x] Legal/reputation risks
- [x] Add escalation detection for general threads:
  - [x] Urgent requests
  - [x] Important stakeholders
  - [x] Time-sensitive deadlines
- [x] Add thread status classification (active/waiting/resolved)
- [x] Add validation for escalation and status fields
- [x] Update database update logic to save new fields

**Files Modified**:
- `supabase/functions/process-mail-summary/index.ts`

**Commits**:
- `1f286dc` - feat: Add enhanced 6-view navigation for mail management (Phase 2)
- `8226dde` - feat: Add AI detection for escalations and thread status

---

## Phase 3: Background Service Worker Architecture ✅ MOSTLY COMPLETE

**Goal**: Move Gmail sync and processing to background service worker for better performance

**Status**: Architecture already implemented with server-side OAuth! 🎉

### Background Service Worker Setup ✅ COMPLETE
- [x] Background service worker at `src/pages/background/index.ts` (490 lines)
- [x] Periodic alarms configured:
  - [x] `periodicSync` every 2 minutes (fetches all external data)
  - [x] Supabase sync every 10 minutes
- [x] Mail sync via `fetchAndCacheMailMessages()` integrated
- [x] Chrome storage caching for fast UI loads
- [x] Message handlers for foreground communication

**Existing Files**:
- ✅ `src/pages/background/index.ts` (490 lines) - Main service worker
- ✅ `src/utils/mailThreadsSync.ts` - Fetches from Supabase
- ✅ `src/utils/mailSupabaseSync.ts` - Writes to Supabase
- ✅ `manifest.json` - Already configured

### OAuth Integration ✅ COMPLETE (Server-Side!)
- [x] **Server-side OAuth via Supabase Edge Functions** (better than Chrome Identity!)
- [x] `gmail-oauth-init` Edge Function - Generates OAuth URL
- [x] `gmail-oauth-callback` Edge Function - Exchanges code for tokens
- [x] Encrypted token storage in `oauth_tokens` table (pgcrypto)
- [x] Token refresh with advisory locks (prevents race conditions)
- [x] "Connect Gmail" button in Settings UI
- [x] OAuth flow opens in new tab, auto-closes on success

**Why Server-Side OAuth is Better**:
- ✅ Tokens encrypted and stored in Supabase (multi-device sync)
- ✅ Server handles token refresh automatically
- ✅ Works even when browser is closed (cron jobs)
- ✅ No sensitive tokens in extension code
- ✅ Centralized OAuth management

**Existing Edge Functions**:
- ✅ `supabase/functions/gmail-oauth-init/index.ts`
- ✅ `supabase/functions/gmail-oauth-callback/index.ts`
- ✅ `supabase/functions/sync-gmail/index.ts` (handles Gmail API + archive queue)

### Gmail API Integration ✅ COMPLETE (Server-Side!)
- [x] **All Gmail API operations handled server-side by sync-gmail Edge Function**
- [x] Gmail History API for incremental sync
- [x] Thread fetching with full message details
- [x] Archive operations via modify API
- [x] Token refresh on expiry
- [x] Exponential backoff retry logic

**Architecture Decision**:
- Extension does NOT call Gmail API directly (security + reliability)
- Extension reads from Supabase (populated by Edge Function every 2min)
- Extension writes user actions to Supabase (archive_thread RPC)
- Edge Function processes everything server-side

### Local Caching ✅ ALREADY IMPLEMENTED
- [x] Chrome storage used for caching (see `storageManager.ts`)
- [x] Cache expiration handled by background worker
- [x] Threads cached via `setMailMessages()` / `getMailMessages()`
- [x] Cache updates every 2 minutes automatically
- [x] UI loads from cache first (instant render)

**Existing Implementation**:
- ✅ `src/utils/storageManager.ts` - Chrome storage wrapper
- ✅ Background worker caches all data every 2 minutes
- ✅ Foreground requests cached data via `chrome.runtime.sendMessage`

### UI-Background Communication ✅ ALREADY IMPLEMENTED
- [x] Preact components use chrome.storage directly
- [x] Background worker has message handlers:
  - [x] `getAllData` - Get all cached data
  - [x] `refreshData` - Force immediate refresh
  - [x] `syncNow` - Trigger full sync
- [x] Background broadcasts updates via chrome.storage changes
- [x] UI listens for storage changes and updates reactively

**Existing Implementation**:
- ✅ Background worker has full message handler (lines 367-440)
- ✅ UI components read from chrome.storage via signals
- ✅ Automatic reactivity via Preact signals

### Setup & Onboarding Flow ✅ COMPLETE
- [x] Settings page has full Supabase configuration UI
- [x] "Connect Gmail" button triggers OAuth flow
- [x] OAuth opens in new tab, auto-closes on success
- [x] Credentials stored in Supabase settings table (encrypted)
- [x] First-time sync triggers automatically after OAuth

**Existing Implementation**:
- ✅ `src/components/Settings/SettingsView.tsx` - Full setup UI
- ✅ Supabase configuration form
- ✅ Gmail OAuth connection button
- ✅ Status indicators and instructions

## What's Actually Missing from Phase 3?

### Minor Improvements Needed 🔧
- [ ] Add offline queue for user actions (archive/mark read while offline)
- [ ] Add retry logic with exponential backoff for failed Supabase writes
- [ ] Add loading states and error handling in MailView
- [ ] Add "Retry" button for failed archive operations
- [ ] Add network status indicator in UI

**Estimated Effort**: 3-4 hours

---

## Phase 4: Advanced Features ⏳ NOT STARTED

**Goal**: Add smart automation and advanced email management

### Newsletter Auto-Archive ⏳ NOT STARTED
- [ ] Add background alarm for hourly newsletter check
- [ ] Implement `archiveOldNewsletters()` function
- [ ] Query threads with category='newsletter' and >7 days old
- [ ] Batch archive in Gmail
- [ ] Update status in Supabase
- [ ] Add auto_archive_after field to track schedule
- [ ] Add UI indicator for scheduled archive time

**Estimated Effort**: 2-3 hours

### Todo Management Panel ⏳ NOT STARTED
- [ ] Create TodoPanel.jsx component
- [ ] Show todos from selected thread
- [ ] Add todo completion UI
- [ ] Add todo priority indicators
- [ ] Add due date highlighting
- [ ] Filter todos by owner (our team vs customer)
- [ ] Add todo completion tracking

**Estimated Files**:
- `src/components/Mail/TodoPanel.jsx` (NEW - ~150 lines)
- `src/stores/todo-store.js` (NEW - ~80 lines)

### Bulk Operations ⏳ NOT STARTED
- [ ] Add multi-select checkboxes to thread list
- [ ] Create bulk action toolbar
- [ ] Implement bulk archive
- [ ] Implement bulk mark as read
- [ ] Implement bulk label application
- [ ] Add confirmation dialogs for bulk actions

**Estimated Effort**: 4-5 hours

### Smart Filters & Search ⏳ NOT STARTED
- [ ] Add search bar to top navigation
- [ ] Implement full-text search across threads
- [ ] Add filter by date range
- [ ] Add filter by customer/sender
- [ ] Add filter by labels
- [ ] Add saved search functionality
- [ ] Add search history

**Estimated Effort**: 5-6 hours

### Customer Insights ⏳ NOT STARTED
- [ ] Add customer profile sidebar
- [ ] Show customer MRR and tier
- [ ] Show conversation history count
- [ ] Show satisfaction score trend
- [ ] Show total action items
- [ ] Link to external CRM (if available)
- [ ] Add customer notes functionality

**Estimated Effort**: 6-8 hours

---

## Phase 5: Performance & Optimization ⏳ NOT STARTED

**Goal**: Optimize for speed and reliability

### Performance Improvements ⏳ NOT STARTED
- [ ] Add virtual scrolling for long thread lists
- [ ] Implement lazy loading for thread content
- [ ] Add loading skeletons for better UX
- [ ] Optimize Preact signal usage
- [ ] Add debouncing to search
- [ ] Minimize re-renders with memo/useMemo
- [ ] Add service worker caching for assets

**Estimated Effort**: 4-5 hours

### Error Handling & Resilience ⏳ NOT STARTED
- [ ] Add global error boundary
- [ ] Implement offline detection
- [ ] Add retry logic for failed API calls
- [ ] Show user-friendly error messages
- [ ] Add error reporting to Sentry (optional)
- [ ] Add connection status indicator
- [ ] Implement request queuing for offline mode

**Estimated Effort**: 5-6 hours

### Testing & Quality ⏳ NOT STARTED
- [ ] Add unit tests for stores
- [ ] Add unit tests for utils
- [ ] Add integration tests for background worker
- [ ] Add E2E tests for critical flows
- [ ] Add TypeScript strict mode
- [ ] Add ESLint configuration
- [ ] Add pre-commit hooks

**Estimated Effort**: 8-10 hours

---

## Phase 6: Analytics & Monitoring ⏳ NOT STARTED

**Goal**: Add insights and monitoring

### Usage Analytics ⏳ NOT STARTED
- [ ] Track email volume by category
- [ ] Track average response time
- [ ] Track escalation rate
- [ ] Track todo completion rate
- [ ] Track archive activity
- [ ] Create dashboard view
- [ ] Add export to CSV

**Estimated Effort**: 6-8 hours

### Performance Monitoring ⏳ NOT STARTED
- [ ] Add Chrome DevTools performance marks
- [ ] Track sync duration
- [ ] Track UI render times
- [ ] Track cache hit rate
- [ ] Add performance dashboard
- [ ] Set up alerting for slow operations

**Estimated Effort**: 3-4 hours

---

## Deployment Checklist

### Production Readiness
- [x] Database migrations deployed
- [x] Edge functions deployed (Phase 1 + Phase 2 AI updates)
- [ ] Background service worker tested
- [ ] Chrome extension packaged
- [ ] OAuth credentials configured
- [ ] Error monitoring set up
- [ ] User documentation written
- [ ] Privacy policy created
- [ ] Chrome Web Store listing prepared

### Monitoring
- [x] Archive queue monitoring available
- [x] Cron job status tracking
- [x] Edge function logs accessible
- [ ] Background worker error tracking
- [ ] Performance metrics dashboard
- [ ] User feedback collection

---

## Timeline Estimates

| Phase | Status | Estimated Time | Completion Date |
|-------|--------|---------------|-----------------|
| Phase 1: Archive | ✅ Complete | 8 hours | 2025-11-19 |
| Phase 2: Enhanced Views | ✅ Complete | 6 hours | 2025-11-19 |
| Phase 3: Background Worker | 🚧 In Progress | 16-20 hours | TBD |
| Phase 4: Advanced Features | ⏳ Not Started | 20-25 hours | TBD |
| Phase 5: Optimization | ⏳ Not Started | 17-21 hours | TBD |
| Phase 6: Analytics | ⏳ Not Started | 9-12 hours | TBD |

**Total Estimated Time**: 76-92 hours (excluding Phase 1 & 2)

---

## Technical Debt & Improvements

### Current Issues
- [ ] No offline support yet
- [ ] No background sync (client-side only)
- [ ] No local caching (fetches from Supabase each time)
- [ ] Limited error handling in UI
- [ ] No retry logic for failed operations
- [ ] No rate limiting protection
- [ ] No request queuing

### Proposed Solutions
- Implement service worker architecture (Phase 3)
- Add local caching with chrome.storage.local
- Add comprehensive error boundaries
- Implement exponential backoff for retries
- Add rate limiting with usage_tracking table
- Add offline queue for user actions

---

## Architecture Decisions

### Why Background Service Worker?
- **Performance**: Heavy Gmail API operations don't block UI
- **Reliability**: Periodic sync continues even when UI is closed
- **Battery**: Efficient alarm-based scheduling vs polling
- **Caching**: Local storage for instant UI rendering
- **Offline**: Queue user actions for later sync

### Why Preact + Signals?
- **Size**: Tiny bundle size (3kb) perfect for extension
- **Performance**: Minimal re-renders with fine-grained reactivity
- **Familiar**: React-like API, easy to learn
- **Signals**: Better than React state for global state management

### Why Chrome Extension over Web App?
- **Integration**: Deep Gmail integration with OAuth
- **Performance**: Local caching with chrome.storage
- **UX**: New tab override for instant access
- **Offline**: Works without internet connection
- **Privacy**: Data stays local + encrypted in Supabase

---

## Success Metrics

### User Experience
- Thread load time < 100ms (from cache)
- Archive action completes < 200ms (optimistic update)
- Background sync interval: 5 minutes
- Cache hit rate > 90%

### Reliability
- Archive success rate > 99%
- AI classification accuracy > 95%
- Zero data loss on failed operations
- Graceful degradation on API failures

### Business Impact
- Reduce email processing time by 50%
- Increase customer satisfaction scores
- Reduce escalation response time
- Improve todo completion rate

---

## Notes & Decisions

### 2025-11-19
- ✅ Completed Phase 1: Archive functionality with queue-based Gmail sync
- ✅ Fixed SQL syntax error in cleanup_archive_queue function
- ✅ Added optimistic UI updates for instant feedback
- ✅ Completed Phase 2: Enhanced 6-view navigation
- ✅ Updated AI prompts to detect escalations and thread status
- 📝 Next: Begin Phase 3 (Background Service Worker Architecture)

### Key Architectural Decisions
1. **Hybrid Sync**: Server handles Gmail sync (Edge Function), client handles user actions (Extension)
2. **Queue Pattern**: gmail_archive_queue table for reliable async operations
3. **Optimistic Updates**: UI updates immediately, background syncs later
4. **AI-Powered**: Claude Haiku for classification, escalation, and status detection
5. **Thread-Based**: Conversations > individual messages for founder context

---

## References

- [Chrome Extension Manifest V3 Docs](https://developer.chrome.com/docs/extensions/mv3/)
- [Gmail API Reference](https://developers.google.com/gmail/api/reference/rest)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Preact Signals Guide](https://preactjs.com/guide/v10/signals/)
- [Chrome Identity API](https://developer.chrome.com/docs/extensions/reference/identity/)

---

**End of TODO List**
