import { extractFigmaFileKey, extractFigmaNodeId } from './urlCleaner';

/**
 * Configuration for Figma API
 */
const FIGMA_API_BASE_URL = 'https://api.figma.com/v1';

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
 * Get enhanced title for Figma URL using the Figma API
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

    // Fetch file metadata
    const fileData = await fetchFigmaFile(fileKey, apiKey);
    const fileName = fileData.name;

    // If there's a node ID, fetch the specific node
    if (nodeId) {
      try {
        const nodeData = await fetchFigmaNode(fileKey, nodeId, apiKey);
        if (nodeData && nodeData.name) {
          return `${fileName} - ${nodeData.name}`;
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
