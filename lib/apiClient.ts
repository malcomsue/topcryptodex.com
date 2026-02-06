/**
 * Fetch wrapper that automatically includes the Privy access token
 * in the Authorization header for authenticated API requests.
 */
export async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
  getAccessToken: () => Promise<string | null>
): Promise<Response> {
  const token = await getAccessToken();

  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
