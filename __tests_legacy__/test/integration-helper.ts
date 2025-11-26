/**
 * Helper for integration tests
 * Sets up the base URL for API calls when running against a live server
 */

export const TEST_SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:5173';

/**
 * Convert relative API path to absolute URL for testing
 */
export function getTestApiUrl(path: string): string {
  if (path.startsWith('http')) {
    return path;
  }
  return `${TEST_SERVER_URL}${path}`;
}

