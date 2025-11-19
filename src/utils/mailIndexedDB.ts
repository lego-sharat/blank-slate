/**
 * IndexedDB wrapper for local mail caching
 *
 * Provides offline access to mail messages, summaries, and action items.
 * Syncs with Supabase backend and caches ~50MB of recent emails.
 *
 * Database Schema:
 * - mail_messages: Email messages with indexes on date, category, isUnread
 * - mail_summaries: AI-generated summaries
 * - mail_action_items: Extracted action items
 */

const DB_NAME = 'MailCache'
const DB_VERSION = 1

const STORE_MESSAGES = 'mail_messages'
const STORE_SUMMARIES = 'mail_summaries'
const STORE_ACTION_ITEMS = 'mail_action_items'

export interface MailMessageDB {
  id: string // UUID from Supabase
  gmail_message_id: string
  thread_id: string
  subject: string | null
  from_email: string
  from_name: string | null
  to_addresses: any[]
  date: string // ISO timestamp
  snippet: string | null
  body_preview: string | null
  labels: string[]
  category: 'onboarding' | 'support' | 'general' | null
  is_unread: boolean
  has_attachments: boolean
  created_at: string
  updated_at: string
}

export interface MailSummaryDB {
  id: string // UUID from Supabase
  message_id: string // FK to mail_messages
  summary: string
  created_at: string
}

export interface MailActionItemDB {
  id: string // UUID from Supabase
  message_id: string // FK to mail_messages
  description: string
  due_date: string | null
  priority: 'high' | 'medium' | 'low'
  is_completed: boolean
  created_at: string
  completed_at: string | null
}

/**
 * Initialize IndexedDB for mail caching
 */
export async function initMailDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Create mail_messages store
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const messagesStore = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' })
        messagesStore.createIndex('date', 'date', { unique: false })
        messagesStore.createIndex('category', 'category', { unique: false })
        messagesStore.createIndex('is_unread', 'is_unread', { unique: false })
        messagesStore.createIndex('thread_id', 'thread_id', { unique: false })
        console.log('✓ Created mail_messages store with indexes')
      }

      // Create mail_summaries store
      if (!db.objectStoreNames.contains(STORE_SUMMARIES)) {
        const summariesStore = db.createObjectStore(STORE_SUMMARIES, { keyPath: 'id' })
        summariesStore.createIndex('message_id', 'message_id', { unique: true })
        console.log('✓ Created mail_summaries store')
      }

      // Create mail_action_items store
      if (!db.objectStoreNames.contains(STORE_ACTION_ITEMS)) {
        const actionItemsStore = db.createObjectStore(STORE_ACTION_ITEMS, { keyPath: 'id' })
        actionItemsStore.createIndex('message_id', 'message_id', { unique: false })
        actionItemsStore.createIndex('is_completed', 'is_completed', { unique: false })
        actionItemsStore.createIndex('due_date', 'due_date', { unique: false })
        console.log('✓ Created mail_action_items store')
      }
    }
  })
}

/**
 * Save mail messages to IndexedDB
 */
export async function saveMessagesToCache(messages: MailMessageDB[]): Promise<void> {
  const db = await initMailDB()
  const transaction = db.transaction([STORE_MESSAGES], 'readwrite')
  const store = transaction.objectStore(STORE_MESSAGES)

  for (const message of messages) {
    store.put(message)
  }

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      console.log(`✓ Cached ${messages.length} messages to IndexedDB`)
      resolve()
    }
    transaction.onerror = () => reject(transaction.error)
  })
}

/**
 * Get all mail messages from IndexedDB
 * Sorted by date descending (newest first)
 */
export async function getMessagesFromCache(options?: {
  category?: 'onboarding' | 'support' | 'general'
  unreadOnly?: boolean
  limit?: number
}): Promise<MailMessageDB[]> {
  const db = await initMailDB()
  const transaction = db.transaction([STORE_MESSAGES], 'readonly')
  const store = transaction.objectStore(STORE_MESSAGES)

  // Get all messages
  const allMessages: MailMessageDB[] = await new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })

  // Filter by category if specified
  let filtered = allMessages
  if (options?.category) {
    filtered = filtered.filter((msg) => msg.category === options.category)
  }

  // Filter by unread if specified
  if (options?.unreadOnly) {
    filtered = filtered.filter((msg) => msg.is_unread)
  }

  // Sort by date descending
  filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  // Apply limit if specified
  if (options?.limit) {
    filtered = filtered.slice(0, options.limit)
  }

  return filtered
}

/**
 * Get a single message by ID
 */
export async function getMessageFromCache(messageId: string): Promise<MailMessageDB | null> {
  const db = await initMailDB()
  const transaction = db.transaction([STORE_MESSAGES], 'readonly')
  const store = transaction.objectStore(STORE_MESSAGES)

  return new Promise((resolve, reject) => {
    const request = store.get(messageId)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Save mail summaries to IndexedDB
 */
export async function saveSummariesToCache(summaries: MailSummaryDB[]): Promise<void> {
  const db = await initMailDB()
  const transaction = db.transaction([STORE_SUMMARIES], 'readwrite')
  const store = transaction.objectStore(STORE_SUMMARIES)

  for (const summary of summaries) {
    store.put(summary)
  }

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      console.log(`✓ Cached ${summaries.length} summaries to IndexedDB`)
      resolve()
    }
    transaction.onerror = () => reject(transaction.error)
  })
}

/**
 * Get summary for a specific message
 */
export async function getSummaryFromCache(messageId: string): Promise<MailSummaryDB | null> {
  const db = await initMailDB()
  const transaction = db.transaction([STORE_SUMMARIES], 'readonly')
  const store = transaction.objectStore(STORE_SUMMARIES)
  const index = store.index('message_id')

  return new Promise((resolve, reject) => {
    const request = index.get(messageId)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Save action items to IndexedDB
 */
export async function saveActionItemsToCache(actionItems: MailActionItemDB[]): Promise<void> {
  const db = await initMailDB()
  const transaction = db.transaction([STORE_ACTION_ITEMS], 'readwrite')
  const store = transaction.objectStore(STORE_ACTION_ITEMS)

  for (const item of actionItems) {
    store.put(item)
  }

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      console.log(`✓ Cached ${actionItems.length} action items to IndexedDB`)
      resolve()
    }
    transaction.onerror = () => reject(transaction.error)
  })
}

/**
 * Get action items for a specific message
 */
export async function getActionItemsFromCache(messageId: string): Promise<MailActionItemDB[]> {
  const db = await initMailDB()
  const transaction = db.transaction([STORE_ACTION_ITEMS], 'readonly')
  const store = transaction.objectStore(STORE_ACTION_ITEMS)
  const index = store.index('message_id')

  return new Promise((resolve, reject) => {
    const request = index.getAll(messageId)
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get all uncompleted action items
 */
export async function getUncompletedActionItems(): Promise<MailActionItemDB[]> {
  const db = await initMailDB()
  const transaction = db.transaction([STORE_ACTION_ITEMS], 'readonly')
  const store = transaction.objectStore(STORE_ACTION_ITEMS)
  const index = store.index('is_completed')

  return new Promise((resolve, reject) => {
    const request = index.getAll(IDBKeyRange.only(false)) // Get where is_completed = false
    request.onsuccess = () => {
      const items = request.result || []
      // Sort by due date (nulls last)
      items.sort((a, b) => {
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
      })
      resolve(items)
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Mark action item as completed
 */
export async function completeActionItem(itemId: string): Promise<void> {
  const db = await initMailDB()
  const transaction = db.transaction([STORE_ACTION_ITEMS], 'readwrite')
  const store = transaction.objectStore(STORE_ACTION_ITEMS)

  const item = await new Promise<MailActionItemDB>((resolve, reject) => {
    const request = store.get(itemId)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  if (item) {
    item.is_completed = true
    item.completed_at = new Date().toISOString()
    store.put(item)
  }

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

/**
 * Clear all mail cache
 */
export async function clearMailCache(): Promise<void> {
  const db = await initMailDB()
  const transaction = db.transaction([STORE_MESSAGES, STORE_SUMMARIES, STORE_ACTION_ITEMS], 'readwrite')

  transaction.objectStore(STORE_MESSAGES).clear()
  transaction.objectStore(STORE_SUMMARIES).clear()
  transaction.objectStore(STORE_ACTION_ITEMS).clear()

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => {
      console.log('✓ Mail cache cleared')
      resolve()
    }
    transaction.onerror = () => reject(transaction.error)
  })
}

/**
 * Get cache statistics
 */
export async function getMailCacheStats(): Promise<{
  messagesCount: number
  summariesCount: number
  actionItemsCount: number
  unreadCount: number
}> {
  const db = await initMailDB()

  const messages = await getMessagesFromCache()
  const unreadMessages = messages.filter((msg) => msg.is_unread)

  const transaction = db.transaction([STORE_SUMMARIES, STORE_ACTION_ITEMS], 'readonly')

  const summariesCount = await new Promise<number>((resolve, reject) => {
    const request = transaction.objectStore(STORE_SUMMARIES).count()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  const actionItemsCount = await new Promise<number>((resolve, reject) => {
    const request = transaction.objectStore(STORE_ACTION_ITEMS).count()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

  return {
    messagesCount: messages.length,
    summariesCount,
    actionItemsCount,
    unreadCount: unreadMessages.length,
  }
}
