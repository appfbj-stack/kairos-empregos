function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('super_token');
}

export async function superApi<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      msg = JSON.parse(text).error || text;
    } catch {}
    if (res.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('super_token');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/super-admin/login';
        }
      }
    }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.json();
}