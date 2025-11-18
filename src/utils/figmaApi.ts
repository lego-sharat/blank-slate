import { extractFigmaFileKey, extractFigmaNodeId } from './urlCleaner';

/**
 * Configuration for Figma API
 */
const FIGMA_API_BASE_URL = 'https://api.figma.com/v1';

/**
 * Cache TTL: 24 hours
 */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Cached metadata for Figma files and nodes
 */
interface FigmaCacheEntry {
  name: string;
  timestamp: number;
}

interface FigmaCache {
  files: { [fileKey: string]: FigmaCacheEntry };
  nodes: { [cacheKey: string]: FigmaCacheEntry }; // Key format: "fileKey:nodeId"
}

/**
 * Get Figma cache from chrome storage
 */
async function getFigmaCache(): Promise<FigmaCache> {
  try {
    const result = await chrome.storage.local.get('figma_cache');
    const cache = result.figma_cache;

    // Type guard to ensure we have a valid cache structure
    if (cache && typeof cache === 'object' && 'files' in cache && 'nodes' in cache) {
      return cache as FigmaCache;
    }

    return { files: {}, nodes: {} };
  } catch (e) {
    console.error('Error getting Figma cache:', e);
    return { files: {}, nodes: {} };
  }
}

/**
 * Save Figma cache to chrome storage
 */
async function saveFigmaCache(cache: FigmaCache): Promise<void> {
  try {
    await chrome.storage.local.set({ figma_cache: cache });
  } catch (e) {
    console.error('Error saving Figma cache:', e);
  }
}

/**
 * Check if a cache entry is still valid
 */
function isCacheValid(entry: FigmaCacheEntry | undefined): boolean {
  if (!entry) return false;
  const age = Date.now() - entry.timestamp;
  return age < CACHE_TTL_MS;
}

/**
 * Get cached file name if available and valid
 */
async function getCachedFileName(fileKey: string): Promise<string | null> {
  const cache = await getFigmaCache();
  const entry = cache.files[fileKey];
  return isCacheValid(entry) ? entry.name : null;
}

/**
 * Get cached node name if available and valid
 */
async function getCachedNodeName(fileKey: string, nodeId: string): Promise<string | null> {
  const cache = await getFigmaCache();
  const cacheKey = `${fileKey}:${nodeId}`;
  const entry = cache.nodes[cacheKey];
  return isCacheValid(entry) ? entry.name : null;
}

/**
 * Cache file name
 */
async function cacheFileName(fileKey: string, name: string): Promise<void> {
  const cache = await getFigmaCache();
  cache.files[fileKey] = { name, timestamp: Date.now() };
  await saveFigmaCache(cache);
}

/**
 * Cache node name
 */
async function cacheNodeName(fileKey: string, nodeId: string, name: string): Promise<void> {
  const cache = await getFigmaCache();
  const cacheKey = `${fileKey}:${nodeId}`;
  cache.nodes[cacheKey] = { name, timestamp: Date.now() };
  await saveFigmaCache(cache);
}

/**
 * Figma API error types
 */
export class FigmaApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'FigmaApiError';
  }
}

/**
 * Figma node response from API
 */
interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
}

interface FigmaFileResponse {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  document: FigmaNode;
}

interface FigmaNodeResponse {
  name: string;
  nodes: {
    [nodeId: string]: {
      document: FigmaNode;
    };
  };
}

/**
 * Get Figma API key from chrome storage (settings)
 */
async function getFigmaApiKey(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get('settings');
    const settings = result.settings as { figmaApiKey?: string } | undefined;
    return settings?.figmaApiKey || null;
  } catch (e) {
    console.error('Error getting Figma API key:', e);
    return null;
  }
}

/**
 * Fetch Figma file metadata
 */
async function fetchFigmaFile(fileKey: string, apiKey: string): Promise<FigmaFileResponse> {
  const url = `${FIGMA_API_BASE_URL}/files/${fileKey}`;

  const response = await fetch(url, {
    headers: {
      'X-Figma-Token': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new FigmaApiError(
      `Figma API request failed: ${response.statusText}`,
      response.status,
      errorText
    );
  }

  return response.json();
}

/**
 * Fetch specific Figma node information
 */
async function fetchFigmaNode(
  fileKey: string,
  nodeId: string,
  apiKey: string
): Promise<FigmaNode | null> {
  const url = `${FIGMA_API_BASE_URL}/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`;

  const response = await fetch(url, {
    headers: {
      'X-Figma-Token': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new FigmaApiError(
      `Figma API request failed: ${response.statusText}`,
      response.status,
      errorText
    );
  }

  const data: FigmaNodeResponse = await response.json();

  // Extract the node from the response
  if (data.nodes && data.nodes[nodeId]) {
    return data.nodes[nodeId].document;
  }

  return null;
}

/**
 * Get enhanced title for Figma URL using the Figma API with caching
 * Returns a title in the format: "File Name - Node Name" or just "File Name" if no node
 */
export async function getFigmaTitle(url: string, fallbackTitle?: string): Promise<string> {
  try {
    const apiKey = await getFigmaApiKey();

    // If no API key, return fallback
    if (!apiKey) {
      return fallbackTitle || 'Figma File';
    }

    const fileKey = extractFigmaFileKey(url);
    if (!fileKey) {
      return fallbackTitle || 'Figma File';
    }

    const nodeId = extractFigmaNodeId(url);

    // Try to get file name from cache
    let fileName = await getCachedFileName(fileKey);

    // If not in cache, fetch from API
    if (!fileName) {
      console.log(`[Figma API] Cache miss for file ${fileKey}, fetching from API...`);
      const fileData = await fetchFigmaFile(fileKey, apiKey);
      fileName = fileData.name;

      // Cache the file name
      await cacheFileName(fileKey, fileName);
      console.log(`[Figma API] Cached file name: ${fileName}`);
    } else {
      console.log(`[Figma API] Cache hit for file ${fileKey}: ${fileName}`);
    }

    // If there's a node ID, try to get node name from cache or fetch
    if (nodeId) {
      try {
        let nodeName = await getCachedNodeName(fileKey, nodeId);

        // If not in cache, fetch from API
        if (!nodeName) {
          console.log(`[Figma API] Cache miss for node ${nodeId}, fetching from API...`);
          const nodeData = await fetchFigmaNode(fileKey, nodeId, apiKey);
          if (nodeData && nodeData.name) {
            nodeName = nodeData.name;

            // Cache the node name
            await cacheNodeName(fileKey, nodeId, nodeName);
            console.log(`[Figma API] Cached node name: ${nodeName}`);
          }
        } else {
          console.log(`[Figma API] Cache hit for node ${nodeId}: ${nodeName}`);
        }

        if (nodeName) {
          return `${fileName} - ${nodeName}`;
        }
      } catch (e) {
        console.error('Error fetching Figma node:', e);
        // Fall through to return just the file name
      }
    }

    return fileName;
  } catch (e) {
    console.error('Error fetching Figma title:', e);

    // If API call fails, return fallback title
    return fallbackTitle || 'Figma File';
  }
}

/**
 * Check if Figma API is configured
 */
export async function isFigmaApiConfigured(): Promise<boolean> {
  const apiKey = await getFigmaApiKey();
  return apiKey !== null && apiKey !== '';
}

/**
 * Test Figma API key validity by making a simple API call
 */
export async function testFigmaApiKey(apiKey: string): Promise<boolean> {
  try {
    // Use a simple endpoint to test the key
    const response = await fetch(`${FIGMA_API_BASE_URL}/me`, {
      headers: {
        'X-Figma-Token': apiKey,
      },
    });

    return response.ok;
  } catch (e) {
    console.error('Error testing Figma API key:', e);
    return false;
  }
}

/**
 * Clear all Figma cache
 */
export async function clearFigmaCache(): Promise<void> {
  await chrome.storage.local.remove('figma_cache');
  console.log('[Figma API] Cache cleared');
}

/**
 * Get cache statistics
 */
export async function getFigmaCacheStats(): Promise<{
  fileCount: number;
  nodeCount: number;
  oldestEntry: number | null;
}> {
  const cache = await getFigmaCache();
  const files = Object.values(cache.files);
  const nodes = Object.values(cache.nodes);
  const allEntries = [...files, ...nodes];

  return {
    fileCount: files.length,
    nodeCount: nodes.length,
    oldestEntry: allEntries.length > 0
      ? Math.min(...allEntries.map(e => e.timestamp))
      : null,
  };
}
