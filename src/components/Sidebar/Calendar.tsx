import { useEffect } from 'preact/hooks';
import { isAuthenticated, calendarEvents } from '@/store/store';
import { refreshAllData } from '@/utils/dataSync';

interface CalendarEvent {
  id: string;
  summary: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  conferenceData?: {
    entryPoints?: Array<{
      entryPointType: string;
      uri: string;
      label?: string;
    }>;
  };
  description?: string;
  attachments?: Array<{
    fileUrl: string;
    title: string;
    mimeType?: string;
  }>;
}

interface LinkInfo {
  type: 'meet' | 'zoom' | 'teams' | 'pdf' | 'gdoc' | 'figma' | 'notion';
  url: string;
}

export default function Calendar() {
  // Use cached events from signal (fetched by background script)
  const events = calendarEvents.value as CalendarEvent[];

  // Refresh data when component mounts if authenticated
  useEffect(() => {
    if (isAuthenticated.value) {
      // Request fresh data from background
      refreshAllData();
    }
  }, [isAuthenticated.value]);

  const extractLinks = (event: CalendarEvent): LinkInfo[] => {
    const links: LinkInfo[] = [];

    // Check conference data for meeting links
    if (event.conferenceData?.entryPoints) {
      for (const entryPoint of event.conferenceData.entryPoints) {
        // Skip phone entry points
        if (entryPoint.entryPointType === 'phone') continue;

        const uri = entryPoint.uri.toLowerCase();
        if (uri.includes('meet.google.com')) {
          links.push({ type: 'meet', url: entryPoint.uri });
        } else if (uri.includes('zoom.us')) {
          links.push({ type: 'zoom', url: entryPoint.uri });
        } else if (uri.includes('teams.microsoft.com')) {
          links.push({ type: 'teams', url: entryPoint.uri });
        }
      }
    }

    // Check description for links
    if (event.description) {
      const urlRegex = /(https?:\/\/[^\s<>"]+)/g;
      const urls = event.description.match(urlRegex) || [];

      for (const url of urls) {
        const lowerUrl = url.toLowerCase();

        // Skip phone/tel links
        if (lowerUrl.includes('tel:') || lowerUrl.includes('callto:')) continue;

        // Meeting links
        if (lowerUrl.includes('meet.google.com') && !links.some(l => l.type === 'meet')) {
          links.push({ type: 'meet', url });
        } else if (lowerUrl.includes('zoom.us') && !links.some(l => l.type === 'zoom')) {
          links.push({ type: 'zoom', url });
        } else if (lowerUrl.includes('teams.microsoft.com') && !links.some(l => l.type === 'teams')) {
          links.push({ type: 'teams', url });
        }
        // Document links
        else if (lowerUrl.includes('.pdf') || lowerUrl.includes('/pdf')) {
          links.push({ type: 'pdf', url });
        } else if (lowerUrl.includes('docs.google.com') || lowerUrl.includes('drive.google.com')) {
          links.push({ type: 'gdoc', url });
        } else if (lowerUrl.includes('figma.com')) {
          links.push({ type: 'figma', url });
        } else if (lowerUrl.includes('notion.so') || lowerUrl.includes('notion.site')) {
          links.push({ type: 'notion', url });
        }
      }
    }

    // Check attachments
    if (event.attachments) {
      for (const attachment of event.attachments) {
        const fileUrl = attachment.fileUrl.toLowerCase();

        if (fileUrl.includes('.pdf') || attachment.mimeType?.includes('pdf')) {
          links.push({ type: 'pdf', url: attachment.fileUrl });
        } else if (fileUrl.includes('docs.google.com') || fileUrl.includes('drive.google.com')) {
          links.push({ type: 'gdoc', url: attachment.fileUrl });
        } else if (fileUrl.includes('figma.com')) {
          links.push({ type: 'figma', url: attachment.fileUrl });
        } else if (fileUrl.includes('notion.so') || fileUrl.includes('notion.site')) {
          links.push({ type: 'notion', url: attachment.fileUrl });
        }
      }
    }

    return links;
  };

  const getLinkIcon = (type: LinkInfo['type']) => {
    switch (type) {
      case 'meet':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15.5 5H18a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2.5"/>
            <path d="M23 12l-5-3v6z"/>
            <rect x="2" y="5" width="12" height="14" rx="2"/>
          </svg>
        );
      case 'zoom':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="7" width="20" height="10" rx="2"/>
            <circle cx="8" cy="12" r="2"/>
            <path d="M14 10l6-3v10l-6-3z"/>
          </svg>
        );
      case 'teams':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        );
      case 'pdf':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
        );
      case 'gdoc':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <line x1="10" y1="9" x2="8" y2="9"/>
          </svg>
        );
      case 'figma':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <circle cx="12" cy="5" r="3"/>
            <circle cx="12" cy="19" r="3"/>
            <circle cx="19" cy="12" r="3"/>
            <circle cx="5" cy="12" r="3"/>
          </svg>
        );
      case 'notion':
        return (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
          </svg>
        );
    }
  };

  const formatTime = (dateTime?: string, _dateOnly?: string): string => {
    if (dateTime) {
      const d = new Date(dateTime);
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    }
    return 'All day';
  };

  if (!isAuthenticated.value) {
    return (
      <div class="calendar-widget">
        <div class="calendar-empty">Sign in to view calendar</div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div class="calendar-widget">
        <div class="calendar-empty">No events today</div>
      </div>
    );
  }

  return (
    <div class="calendar-widget">
      {events.map((event) => {
        const links = extractLinks(event);
        const time = formatTime(event.start.dateTime, event.start.date);

        return (
          <div key={event.id} class="calendar-event">
            <div class="calendar-event-time">{time}</div>
            <div class="calendar-event-content">
              <div class="calendar-event-title">{event.summary}</div>
              {links.length > 0 && (
                <div class="calendar-event-links">
                  {links.map((link, idx) => (
                    <a
                      key={idx}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      class={`calendar-event-link calendar-event-link-${link.type}`}
                      title={link.type}
                    >
                      {getLinkIcon(link.type)}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
