import cleanUrls from '@inframanufaktur/clean-urls';

/**
 * Common tracking parameters to remove from URLs
 */
const TRACKING_PARAMS = [
  // UTM parameters
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_source_platform',
  'utm_creative_format',
  'utm_marketing_tactic',

  // Facebook/Meta
  'fbclid',
  'fb_action_ids',
  'fb_action_types',
  'fb_ref',
  'fb_source',

  // Google
  'gclid',
  'gclsrc',
  'dclid',
  '_ga',

  // Other ad platforms
  'msclkid', // Microsoft/Bing
  'mc_cid',  // Mailchimp
  'mc_eid',  // Mailchimp

  // General tracking
  'ref',
  'referrer',
  '_hsenc',  // HubSpot
  '_hsmi',   // HubSpot
  'mkt_tok', // Marketo
  'vero_id', // Vero

  // Social media
  'igshid',  // Instagram
  'twclid',  // Twitter

  // Analytics
  '_branch_match_id',
  '_branch_referrer',
];

/**
 * Platform-specific parameters to preserve
 */
const FIGMA_PRESERVED_PARAMS = [
  'node-id',
  'nodeId',
  'type',
  'scaling',
  'page-id',
  'starting-point-node-id',
  'mode',
  't', // Figma timestamp/version parameter
  'kind',
  'p', // FigJam board parameter
];

const GOOGLE_DOCS_PRESERVED_PARAMS = [
  'usp', // sharing parameter
  'id',
  'edit',
  'copy',
  'comment',
];

const NOTION_PRESERVED_PARAMS = [
  'p', // block/paragraph ID
  'pm', // page mention
  'pvs', // page version state
];

/**
 * Clean URL by removing tracking parameters while preserving important ones
 */
export function cleanUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Use clean-urls library only if not in service worker context
    // (the library requires DOM APIs not available in service workers)
    let cleaned = url;
    if (typeof window !== 'undefined') {
      try {
        cleaned = cleanUrls(url);
      } catch (e) {
        console.warn('clean-urls library failed, continuing without it:', e);
        cleaned = url;
      }
    }

    // Normalize Notion URLs to canonical format (removes slug variations)
    if (hostname.includes('notion.so')) {
      cleaned = normalizeNotionUrl(cleaned);
    }

    // Normalize Figma URLs to canonical format (removes name variations)
    if (hostname.includes('figma.com')) {
      cleaned = normalizeFigmaUrl(cleaned);
    }

    // Then apply our custom cleaning for tracking parameters
    const cleanedUrl = new URL(cleaned);
    const searchParams = cleanedUrl.searchParams;

    // Determine which parameters to preserve based on the platform
    let preservedParams: string[] = [];

    if (hostname.includes('figma.com')) {
      preservedParams = FIGMA_PRESERVED_PARAMS;
    } else if (hostname.includes('docs.google.com')) {
      preservedParams = GOOGLE_DOCS_PRESERVED_PARAMS;
    } else if (hostname.includes('notion.so')) {
      preservedParams = NOTION_PRESERVED_PARAMS;
    }

    // Remove tracking parameters
    const paramsToDelete: string[] = [];
    searchParams.forEach((_value, key) => {
      const lowerKey = key.toLowerCase();

      // Check if it's a tracking parameter and not preserved
      if (
        TRACKING_PARAMS.some(param => lowerKey === param.toLowerCase()) &&
        !preservedParams.some(param => key === param || lowerKey === param.toLowerCase())
      ) {
        paramsToDelete.push(key);
      }
    });

    // Delete the identified tracking parameters
    paramsToDelete.forEach(param => searchParams.delete(param));

    return cleanedUrl.toString();
  } catch (e) {
    console.error('Error cleaning URL:', e);
    return url; // Return original URL if cleaning fails
  }
}

/**
 * Extract Figma node ID from URL
 */
export function extractFigmaNodeId(url: string): string | null {
  try {
    const urlObj = new URL(url);

    // Check for node-id parameter (hyphenated version)
    const nodeIdHyphen = urlObj.searchParams.get('node-id');
    if (nodeIdHyphen) {
      return nodeIdHyphen;
    }

    // Check for nodeId parameter (camelCase version)
    const nodeIdCamel = urlObj.searchParams.get('nodeId');
    if (nodeIdCamel) {
      return nodeIdCamel;
    }

    return null;
  } catch (e) {
    console.error('Error extracting Figma node ID:', e);
    return null;
  }
}

/**
 * Check if URL is a Figma file URL (includes design files and FigJam boards)
 */
export function isFigmaFileUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('figma.com') &&
           (urlObj.pathname.includes('/file/') ||
            urlObj.pathname.includes('/design/') ||
            urlObj.pathname.includes('/board/'));
  } catch (e) {
    return false;
  }
}

/**
 * Extract Figma file key from URL
 * Supports /file/, /design/, and /board/ (FigJam) URLs
 */
export function extractFigmaFileKey(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');

    // Figma URL formats:
    // - /file/{fileKey}/{fileName}
    // - /design/{fileKey}/{fileName}
    // - /board/{boardKey}/{boardName} (FigJam)
    const fileIndex = pathParts.indexOf('file');
    if (fileIndex !== -1 && pathParts.length > fileIndex + 1) {
      return pathParts[fileIndex + 1];
    }

    const designIndex = pathParts.indexOf('design');
    if (designIndex !== -1 && pathParts.length > designIndex + 1) {
      return pathParts[designIndex + 1];
    }

    const boardIndex = pathParts.indexOf('board');
    if (boardIndex !== -1 && pathParts.length > boardIndex + 1) {
      return pathParts[boardIndex + 1];
    }

    return null;
  } catch (e) {
    console.error('Error extracting Figma file key:', e);
    return null;
  }
}

/**
 * Extract Notion page ID from URL
 * Notion URLs format: /workspace/Page-Title-{pageId} or /{pageId}
 * The pageId is a 32-character hex string
 */
export function extractNotionPageId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Notion page ID is 32 characters (hex) at the end of the path
    // Match pattern: 32 hex characters, optionally followed by query params
    const match = pathname.match(/([a-f0-9]{32})(?:\/|$)/i);

    if (match) {
      return match[1];
    }

    return null;
  } catch (e) {
    console.error('Error extracting Notion page ID:', e);
    return null;
  }
}

/**
 * Normalize Notion URL to use canonical format based on page ID
 * This ensures different slugs for the same page are treated as identical
 */
export function normalizeNotionUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pageId = extractNotionPageId(url);

    if (!pageId) {
      return url; // Return as-is if we can't extract ID
    }

    // Get workspace from path (first segment after domain)
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    const workspace = pathParts.length > 0 && !pathParts[0].match(/^[a-f0-9]{32}$/i)
      ? pathParts[0]
      : '';

    // Construct canonical URL: /workspace/{pageId} or /{pageId}
    const canonicalPath = workspace ? `/${workspace}/${pageId}` : `/${pageId}`;

    // Preserve query parameters (like blockId, etc.)
    const canonicalUrl = new URL(canonicalPath, urlObj.origin);
    canonicalUrl.search = urlObj.search;

    return canonicalUrl.toString();
  } catch (e) {
    console.error('Error normalizing Notion URL:', e);
    return url;
  }
}

/**
 * Normalize Figma URL to use canonical format based on file/board key
 * This ensures different names for the same file/board are treated as identical
 * Example:
 *   - /board/ABC123/Old-Name?node-id=1 -> /board/ABC123?node-id=1
 *   - /board/ABC123/New-Name?node-id=1 -> /board/ABC123?node-id=1
 */
export function normalizeFigmaUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    const fileKey = extractFigmaFileKey(url);

    if (!fileKey) {
      return url; // Return as-is if we can't extract file key
    }

    // Determine the type (file, design, or board)
    let type: string | null = null;
    if (pathParts.includes('file')) {
      type = 'file';
    } else if (pathParts.includes('design')) {
      type = 'design';
    } else if (pathParts.includes('board')) {
      type = 'board';
    }

    if (!type) {
      return url; // Can't determine type, return as-is
    }

    // Construct canonical URL: /{type}/{fileKey} (without the name part)
    const canonicalPath = `/${type}/${fileKey}`;

    // Preserve query parameters (node-id, etc.)
    const canonicalUrl = new URL(canonicalPath, urlObj.origin);
    canonicalUrl.search = urlObj.search;

    return canonicalUrl.toString();
  } catch (e) {
    console.error('Error normalizing Figma URL:', e);
    return url;
  }
}

