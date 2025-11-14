# Fetch Calendar Events Edge Function

This Supabase Edge Function fetches Google Calendar events using the user's OAuth token stored in their Supabase session.

## Deployment

```bash
supabase functions deploy fetch-calendar-events
```

## Usage

The extension calls this function with the user's authorization token to fetch calendar events.

### Request

```javascript
POST https://your-project.supabase.co/functions/v1/fetch-calendar-events
Authorization: Bearer <supabase-access-token>
Content-Type: application/json

{
  "timeMin": "2025-01-01T00:00:00Z",
  "timeMax": "2025-01-01T23:59:59Z"
}
```

### Response

```json
{
  "events": [
    {
      "summary": "Event title",
      "start": { "dateTime": "2025-01-01T10:00:00Z" },
      "end": { "dateTime": "2025-01-01T11:00:00Z" },
      ...
    }
  ]
}
```

## Benefits

- Uses provider_token from Supabase session (auto-refreshed)
- No need to manage Google tokens in the extension
- Server-side API calls are more secure
- Simplified client code
