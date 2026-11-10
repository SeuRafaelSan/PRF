import { getCurrentIdToken } from './auth';
import { getAppCheckToken } from './firebase';

/**
 * Authenticated fetch helper that injects Firebase ID Token Bearer header
 * and App Check header for all /api/* calls.
 */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const [token, appCheckToken] = await Promise.all([
    getCurrentIdToken(),
    getAppCheckToken()
  ]);

  const headers = new Headers(init?.headers || {});
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (appCheckToken) {
    headers.set('X-Firebase-AppCheck', appCheckToken);
  }

  // Ensure JSON content-type if body is provided and not already specified
  if (init?.body && !headers.has('Content-Type') && typeof init.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
