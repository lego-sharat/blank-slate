import type { MailMessage } from '@/types';

/**
 * Gmail API endpoint
 */
const GMAIL_API_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Labels that should be skipped (emails with these labels will be excluded)
 */
const SKIP_LABELS = ['update', 'updates', 'promotion', 'promotions', 'social'];

/**
 * Fetches email messages from Gmail API
 */
async function fetchGmailMessages(
  accessToken: string,
  maxResults: number = 50,
  labelIds?: string[]
): Promise<any> {
  const params = new URLSearchParams({
    maxResults: maxResults.toString(),
  });

  if (labelIds && labelIds.length > 0) {
    labelIds.forEach(labelId => params.append('labelIds', labelId));
  }

  const response = await fetch(`${GMAIL_API_URL}/messages?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Gmail API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetches full message details from Gmail API
 */
async function fetchMessageDetails(accessToken: string, messageId: string): Promise<any> {
  const response = await fetch(`${GMAIL_API_URL}/messages/${messageId}?format=full`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Gmail API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Parses email headers to extract sender, recipient, subject, and date
 */
function parseHeaders(headers: Array<{ name: string; value: string }>) {
  const result: any = {
    from: { email: '' },
    to: [],
    subject: '',
    date: '',
  };

  headers.forEach(header => {
    switch (header.name.toLowerCase()) {
      case 'from':
        const fromMatch = header.value.match(/(.*?)\s*<(.+?)>/) || header.value.match(/(.+)/);
        if (fromMatch) {
          result.from = {
            name: fromMatch[1]?.trim().replace(/"/g, '') || undefined,
            email: fromMatch[2]?.trim() || fromMatch[1]?.trim() || '',
          };
        }
        break;
      case 'to':
        const toAddresses = header.value.split(',').map(addr => {
          const toMatch = addr.match(/(.*?)\s*<(.+?)>/) || addr.match(/(.+)/);
          if (toMatch) {
            return {
              name: toMatch[1]?.trim().replace(/"/g, '') || undefined,
              email: toMatch[2]?.trim() || toMatch[1]?.trim() || '',
            };
          }
          return { email: addr.trim() };
        });
        result.to = toAddresses;
        break;
      case 'subject':
        result.subject = header.value;
        break;
      case 'date':
        result.date = header.value;
        break;
    }
  });

  return result;
}

/**
 * Determines the category of an email based on its labels
 */
function categorizeEmail(labelIds: string[], labels: Map<string, string>): 'onboarding' | 'support' | 'general' {
  const labelNames = labelIds.map(id => labels.get(id)?.toLowerCase() || '').filter(Boolean);

  if (labelNames.some(name => name.includes('onboarding') || name.includes('welcome'))) {
    return 'onboarding';
  }

  if (labelNames.some(name => name.includes('support') || name.includes('help'))) {
    return 'support';
  }

  return 'general';
}

/**
 * Checks if an email should be skipped based on its labels
 */
function shouldSkipEmail(labelIds: string[], labels: Map<string, string>): boolean {
  const labelNames = labelIds.map(id => labels.get(id)?.toLowerCase() || '').filter(Boolean);
  return labelNames.some(name => SKIP_LABELS.includes(name));
}

/**
 * Fetches user's Gmail labels
 */
async function fetchLabels(accessToken: string): Promise<Map<string, string>> {
  const response = await fetch(`${GMAIL_API_URL}/labels`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Gmail API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const labelsMap = new Map<string, string>();

  if (data.labels) {
    data.labels.forEach((label: any) => {
      labelsMap.set(label.id, label.name);
    });
  }

  return labelsMap;
}

/**
 * Fetches all mail messages and categorizes them
 */
export async function fetchAllMailMessages(accessToken: string): Promise<{
  all: MailMessage[];
  onboarding: MailMessage[];
  support: MailMessage[];
}> {
  try {
    // Fetch labels first
    const labelsMap = await fetchLabels(accessToken);

    // Fetch inbox messages (excluding trash and spam)
    const messagesResponse = await fetchGmailMessages(accessToken, 50, ['INBOX']);

    if (!messagesResponse.messages || messagesResponse.messages.length === 0) {
      return {
        all: [],
        onboarding: [],
        support: [],
      };
    }

    // Fetch full details for each message
    const messagePromises = messagesResponse.messages.map((msg: any) =>
      fetchMessageDetails(accessToken, msg.id)
    );

    const messagesDetails = await Promise.all(messagePromises);

    // Parse and filter messages
    const allMessages: MailMessage[] = [];
    const onboardingMessages: MailMessage[] = [];
    const supportMessages: MailMessage[] = [];

    messagesDetails.forEach((msgData: any) => {
      // Skip if message should be filtered out
      if (shouldSkipEmail(msgData.labelIds || [], labelsMap)) {
        return;
      }

      const headers = parseHeaders(msgData.payload.headers);
      const isUnread = msgData.labelIds?.includes('UNREAD') || false;
      const category = categorizeEmail(msgData.labelIds || [], labelsMap);

      const message: MailMessage = {
        id: msgData.id,
        threadId: msgData.threadId,
        snippet: msgData.snippet || '',
        subject: headers.subject,
        from: headers.from,
        to: headers.to,
        date: headers.date,
        labels: msgData.labelIds || [],
        isUnread,
        hasAttachments: msgData.payload.parts?.some((part: any) =>
          part.filename && part.filename.length > 0
        ) || false,
        category,
      };

      allMessages.push(message);

      if (category === 'onboarding') {
        onboardingMessages.push(message);
      } else if (category === 'support') {
        supportMessages.push(message);
      }
    });

    return {
      all: allMessages,
      onboarding: onboardingMessages,
      support: supportMessages,
    };
  } catch (error) {
    console.error('Error fetching mail messages:', error);
    throw error;
  }
}
