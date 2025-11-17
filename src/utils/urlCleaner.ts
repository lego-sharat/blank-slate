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
];

const GOOGLE_DOCS_PRESERVED_PARAMS = [
  'usp', // sharing parameter
  'id',
  'edit',
  'copy',
  'comment',
];

/**
 * Clean URL by removing tracking parameters while preserving important ones
 */
export function cleanUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // First, use the clean-urls library
    let cleaned = cleanUrls(url);

    // Then apply our custom cleaning for tracking parameters
    const cleanedUrl = new URL(cleaned);
    const searchParams = cleanedUrl.searchParams;

    // Determine which parameters to preserve based on the platform
    let preservedParams: string[] = [];

    if (hostname.includes('figma.com')) {
      preservedParams = FIGMA_PRESERVED_PARAMS;
    } else if (hostname.includes('docs.google.com')) {
      preservedParams = GOOGLE_DOCS_PRESERVED_PARAMS;
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
 * Check if URL is a Figma file URL
 */
export function isFigmaFileUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('figma.com') &&
           urlObj.pathname.includes('/file/');
  } catch (e) {
    return false;
  }
}

/**
 * Extract Figma file key from URL
 */
export function extractFigmaFileKey(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');

    // Figma URL format: /file/{fileKey}/{fileName}
    const fileIndex = pathParts.indexOf('file');
    if (fileIndex !== -1 && pathParts.length > fileIndex + 1) {
      return pathParts[fileIndex + 1];
    }

    return null;
  } catch (e) {
    console.error('Error extracting Figma file key:', e);
    return null;
  }
}
