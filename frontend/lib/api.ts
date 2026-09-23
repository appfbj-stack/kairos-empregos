/**
 * Helper central de API. Anexa Authorization em todas as requests.
 */
const BASE = '';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth_token');
}

export async function api<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      msg = JSON.parse(text).error || text;
    } catch {
      // keep raw text
    }
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        if (window.location.pathname.startsWith('/dashboard')) {
          window.location.href = '/';
        }
      }
    }
    throw new Error(msg || `HTTP ${res.status}`);
  }

  return res.json();
}

export const publicApi = async <T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> => {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      msg = JSON.parse(text).error || text;
    } catch {}
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json();
};