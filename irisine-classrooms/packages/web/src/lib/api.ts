export const API = process.env.NEXT_PUBLIC_API_URL;

export type PortalKey = 'STUDENT' | 'FACULTY' | 'SUPER_ADMIN' | 'IT_ADMIN';

/** Landing page for the portal the server reported at login. */
export function homeForPortal(portal?: string): string {
  return portal === 'IT_ADMIN' ? '/it-admin' : '/dashboard';
}

/** Tokens live in localStorage (set at login). The server re-checks every request, so this is only convenience. */
export function getToken(): string {
  try {
    return localStorage.getItem('accessToken') || '';
  } catch {
    return '';
  }
}

export function clearSession() {
  try {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  } catch {}
}

export function saveSession(data: { accessToken: string; refreshToken?: string; user: unknown }) {
  localStorage.setItem('accessToken', data.accessToken);
  if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
  localStorage.setItem('user', JSON.stringify(data.user));
}

/** Calls the API with the saved token. Throws an Error with the server's message. A 401 sends the user to /login. */
export async function apiFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(init.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    clearSession();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
  if (!res.ok) {
    const msg = Array.isArray(data.message) ? data.message[0] : data.message;
    throw new Error(msg || `Request failed (${res.status})`);
  }
  return data as T;
}
